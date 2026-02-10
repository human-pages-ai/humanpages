import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { requireActiveAgent } from '../middleware/requireActiveAgent.js';
import { authenticateEither, EitherAuthRequest } from '../middleware/eitherAuth.js';
import { requireActiveIfAgent } from '../middleware/requireActiveAgent.js';
import { sendJobOfferEmail, sendJobOfferUpdatedEmail, sendJobMessageEmail } from '../lib/email.js';
import { sendJobOfferTelegram, sendJobOfferUpdatedTelegram, sendTelegramMessage } from '../lib/telegram.js';
import {
  verifyUsdcPayment,
  PaymentVerificationError,
  SUPPORTED_NETWORKS,
  SUPPORTED_TOKENS,
  type SupportedToken,
} from '../lib/blockchain/index.js';
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { isAllowedUrl, fireWebhook } from '../lib/webhook.js';
import { convertToUsd } from '../lib/exchangeRates.js';

const router = Router();

// IP-based rate limiting: 30 offers per day per IP
// Defense in depth against agentId spoofing
const ipRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 30, // 30 requests per IP per day (above PRO tier to allow multiple agents per IP)
  message: {
    error: 'Too many requests from this IP',
    message: 'IP rate limit: 30 offers per day. Try again later.',
    retryAfter: '24 hours',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  // Disable validation - we handle proxied IPs correctly
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Schema for creating a job offer (called by agents)
const createJobSchema = z.object({
  humanId: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  priceUsdc: z.number().positive(),
  // Agent location for distance filtering
  agentLat: z.number().min(-90).max(90).optional(),
  agentLng: z.number().min(-180).max(180).optional(),
  // Webhook callback
  callbackUrl: z.string().url().optional(),
  callbackSecret: z.string().min(16).max(256).optional(),
});

// Schema for updating a job offer (called by agents)
const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  priceUsdc: z.number().positive().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});

// Rate limit: 10 updates per hour per job
const RATE_LIMIT_UPDATES_PER_JOB = 10;

// Schema for marking job as paid
const markPaidSchema = z.object({
  paymentTxHash: z
    .string()
    .min(1)
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  paymentNetwork: z
    .string()
    .min(1)
    .refine(
      (n) => SUPPORTED_NETWORKS.includes(n.toLowerCase()),
      `Supported networks: ${SUPPORTED_NETWORKS.join(', ')}`
    ),
  paymentToken: z
    .string()
    .optional()
    .default('USDC')
    .refine(
      (t) => SUPPORTED_TOKENS.includes(t.toUpperCase() as SupportedToken),
      `Supported tokens: ${SUPPORTED_TOKENS.join(', ')}`
    ),
  paymentAmount: z.number().positive(),
});

// Schema for leaving a review
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// Tier-based daily offer limits. Accepted jobs don't count toward the limit.
const TIER_OFFER_LIMITS: Record<string, number> = { BASIC: 5, PRO: 15 };
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Create a job offer (requires registered + activated agent)
router.post('/', ipRateLimiter, authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = createJobSchema.parse(req.body);
    const agent = req.agent!;

    // SSRF prevention: validate callback URL points to public endpoint
    if (data.callbackUrl && !(await isAllowedUrl(data.callbackUrl))) {
      return res.status(400).json({
        error: 'Invalid callback URL',
        message: 'Callback URL must be a public HTTP(S) endpoint',
      });
    }

    // Tier-based daily rate limit — accepted jobs don't count
    const tierLimit = TIER_OFFER_LIMITS[agent.activationTier] || TIER_OFFER_LIMITS.BASIC;
    const oneDayAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentOfferCount = await prisma.job.count({
      where: {
        registeredAgentId: agent.id,
        createdAt: { gte: oneDayAgo },
        status: { notIn: ['ACCEPTED', 'COMPLETED', 'PAID'] },
      },
    });

    if (recentOfferCount >= tierLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Your ${agent.activationTier} tier allows ${tierLimit} job offers per day. Accepted offers don't count toward this limit.`,
        tier: agent.activationTier,
        limit: tierLimit,
        retryAfter: '24 hours',
      });
    }

    // Verify human exists, is email-verified, and get contact info + filter settings
    const human = await prisma.human.findUnique({
      where: { id: data.humanId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        email: true,
        emailVerified: true,
        isAvailable: true,
        telegramChatId: true,
        preferredLanguage: true,
        emailNotifications: true,
        // Filter settings
        minOfferPrice: true,
        maxOfferDistance: true,
        minRateUsdc: true,
        rateCurrency: true,
        locationLat: true,
        locationLng: true,
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    if (!human.emailVerified) {
      return res.status(400).json({
        error: 'Human not available',
        message: 'This human has not verified their email and cannot receive job offers.',
      });
    }

    if (!human.isAvailable) {
      return res.status(400).json({
        error: 'Human not available',
        code: 'UNAVAILABLE',
        message: 'This human is not currently accepting job offers.',
      });
    }

    // Check offer filters
    const currency = human.rateCurrency || 'USD';
    const isNonUsd = currency !== 'USD';

    // 1. Minimum price filter (convert local currency min to USD for comparison)
    if (human.minOfferPrice) {
      const minPriceLocal = human.minOfferPrice.toNumber();
      const minPriceUsd = await convertToUsd(minPriceLocal, currency);
      if (data.priceUsdc < minPriceUsd) {
        const localNote = isNonUsd ? ` (${currency} ${minPriceLocal} ~$${Math.round(minPriceUsd)} USD)` : '';
        return res.status(400).json({
          error: 'Offer filtered',
          code: 'PRICE_TOO_LOW',
          message: `This human requires a minimum offer of $${Math.round(minPriceUsd)} USDC${localNote}. Your offer of $${data.priceUsdc} was automatically filtered.`,
          minPrice: minPriceUsd,
          yourPrice: data.priceUsdc,
        });
      }
    }

    // 2. Minimum rate filter (convert local currency rate to USD for comparison)
    if (human.minRateUsdc) {
      const minRateLocal = human.minRateUsdc.toNumber();
      const minRateUsd = await convertToUsd(minRateLocal, currency);
      if (data.priceUsdc < minRateUsd) {
        const localNote = isNonUsd ? ` (${currency} ${minRateLocal} ~$${Math.round(minRateUsd)} USD)` : '';
        return res.status(400).json({
          error: 'Offer filtered',
          code: 'BELOW_MIN_RATE',
          message: `This human's minimum rate is $${Math.round(minRateUsd)} USDC${localNote}. Your offer of $${data.priceUsdc} was automatically filtered.`,
          minRate: minRateUsd,
          yourPrice: data.priceUsdc,
        });
      }
    }

    // 3. Distance filter (if human has location and max distance set)
    if (human.maxOfferDistance && human.locationLat && human.locationLng) {
      if (!data.agentLat || !data.agentLng) {
        return res.status(400).json({
          error: 'Offer filtered',
          code: 'LOCATION_REQUIRED',
          message: `This human only accepts offers from agents within ${human.maxOfferDistance}km. Please provide agentLat and agentLng coordinates. Your offer was automatically filtered to their spam folder.`,
          maxDistance: human.maxOfferDistance,
        });
      }

      const distance = calculateDistance(
        human.locationLat,
        human.locationLng,
        data.agentLat,
        data.agentLng
      );

      if (distance > human.maxOfferDistance) {
        return res.status(400).json({
          error: 'Offer filtered',
          code: 'TOO_FAR',
          message: `This human only accepts offers from agents within ${human.maxOfferDistance}km. You are ${Math.round(distance)}km away. Your offer was automatically filtered to their spam folder.`,
          maxDistance: human.maxOfferDistance,
          yourDistance: Math.round(distance),
        });
      }
    }

    const job = await prisma.job.create({
      data: {
        humanId: data.humanId,
        agentId: data.agentId,
        agentName: data.agentName || agent.name,
        registeredAgentId: agent.id,
        title: data.title,
        description: data.description,
        category: data.category,
        priceUsdc: new Decimal(data.priceUsdc),
        callbackUrl: data.callbackUrl,
        callbackSecret: data.callbackSecret,
        status: 'PENDING',
      },
    });

    const jobDetailUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/${job.id}`;

    const displayName = data.agentName || agent.name;

    // Track job offer creation in PostHog (pass req for country geolocation)
    trackServerEvent(data.agentId, 'job_offer_sent', {
      humanId: data.humanId,
      priceUsdc: data.priceUsdc,
      category: data.category,
      registeredAgentId: agent.id,
    }, req);

    // Send email notification (async, don't block response)
    const notifyEmail = human.contactEmail || human.email;
    if (notifyEmail && human.emailNotifications) {
      sendJobOfferEmail({
        humanName: human.name,
        humanEmail: notifyEmail,
        humanId: human.id,
        jobTitle: data.title,
        jobDescription: data.description,
        priceUsdc: data.priceUsdc,
        agentName: displayName,
        category: data.category,
        language: human.preferredLanguage,
        jobDetailUrl,
        jobId: job.id,
        agentId: agent.id,
      }).catch((err) => logger.error({ err }, 'Email notification failed'));
    }

    // Send Telegram notification (async, don't block response)
    if (human.telegramChatId) {
      sendJobOfferTelegram({
        chatId: human.telegramChatId,
        humanName: human.name,
        jobTitle: data.title,
        jobDescription: data.description,
        priceUsdc: data.priceUsdc,
        agentName: displayName,
        dashboardUrl: jobDetailUrl,
      }).catch((err) => logger.error({ err }, 'Telegram notification failed'));
    }

    res.status(201).json({
      id: job.id,
      status: job.status,
      message: 'Job offer created. Waiting for human to accept.',
      rateLimit: {
        remaining: tierLimit - recentOfferCount - 1,
        resetIn: '24 hours',
        tier: agent.activationTier,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get job by ID (public - for agents to check status)
router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          select: { id: true, name: true },
        },
        review: true,
        registeredAgent: {
          select: { id: true, name: true, description: true, websiteUrl: true, domainVerified: true },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Strip callbackSecret from response to prevent leaking
    const { callbackSecret, ...safeJob } = job;
    res.json(safeJob);
  } catch (error) {
    logger.error({ err: error }, 'Get job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a pending job offer (requires registered agent with API key)
router.patch('/:id', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = updateJobSchema.parse(req.body);
    const agent = req.agent!;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Auth: only the agent that created the job can update it
    if (job.registeredAgentId !== agent.id) {
      return res.status(403).json({ error: 'Not authorized. Only the agent that created this offer can update it.' });
    }

    // Status guard: only PENDING jobs can be updated
    if (job.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Cannot update offer',
        message: `Only PENDING offers can be updated. This offer is ${job.status}.`,
      });
    }

    // Rate limit: 10 updates per hour per job
    if (job.updateCount >= RATE_LIMIT_UPDATES_PER_JOB) {
      const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
      if (job.lastUpdatedByAgent && job.lastUpdatedByAgent > oneHourAgo) {
        return res.status(429).json({
          error: 'Update rate limit exceeded',
          message: `Maximum ${RATE_LIMIT_UPDATES_PER_JOB} updates per job. Try again later.`,
        });
      }
    }

    // If priceUsdc changes, re-validate offer filters
    if (data.priceUsdc !== undefined) {
      const human = await prisma.human.findUnique({
        where: { id: job.humanId },
        select: {
          minOfferPrice: true,
          minRateUsdc: true,
          rateCurrency: true,
        },
      });

      if (human) {
        const currency = human.rateCurrency || 'USD';
        const isNonUsd = currency !== 'USD';

        if (human.minOfferPrice) {
          const minPriceLocal = human.minOfferPrice.toNumber();
          const minPriceUsd = await convertToUsd(minPriceLocal, currency);
          if (data.priceUsdc < minPriceUsd) {
            const localNote = isNonUsd ? ` (${currency} ${minPriceLocal} ~$${Math.round(minPriceUsd)} USD)` : '';
            return res.status(400).json({
              error: 'Offer filtered',
              code: 'PRICE_TOO_LOW',
              message: `This human requires a minimum offer of $${Math.round(minPriceUsd)} USDC${localNote}. Your updated price of $${data.priceUsdc} was filtered.`,
              minPrice: minPriceUsd,
              yourPrice: data.priceUsdc,
            });
          }
        }

        if (human.minRateUsdc) {
          const minRateLocal = human.minRateUsdc.toNumber();
          const minRateUsd = await convertToUsd(minRateLocal, currency);
          if (data.priceUsdc < minRateUsd) {
            const localNote = isNonUsd ? ` (${currency} ${minRateLocal} ~$${Math.round(minRateUsd)} USD)` : '';
            return res.status(400).json({
              error: 'Offer filtered',
              code: 'BELOW_MIN_RATE',
              message: `This human's minimum rate is $${Math.round(minRateUsd)} USDC${localNote}. Your updated price of $${data.priceUsdc} was filtered.`,
              minRate: minRateUsd,
              yourPrice: data.priceUsdc,
            });
          }
        }
      }
    }

    // Build update data
    const updateData: any = {
      lastUpdatedByAgent: new Date(),
      updateCount: { increment: 1 },
    };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priceUsdc !== undefined) updateData.priceUsdc = new Decimal(data.priceUsdc);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: updateData,
    });

    // Track event (pass req for country geolocation)
    trackServerEvent(job.agentId, 'job_offer_updated', {
      jobId: job.id,
      humanId: job.humanId,
      updateCount: updated.updateCount,
      changedFields: Object.keys(data).filter(k => (data as any)[k] !== undefined),
    }, req);

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.updated',
        { changes: data },
      );
    }

    // Send notifications to human
    const human = await prisma.human.findUnique({
      where: { id: job.humanId },
      select: {
        id: true,
        name: true,
        email: true,
        contactEmail: true,
        emailNotifications: true,
        telegramChatId: true,
        preferredLanguage: true,
      },
    });

    if (human) {
      const jobDetailUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/${job.id}`;
      const displayName = job.agentName || agent.name;

      const notifyEmail = human.contactEmail || human.email;
      if (notifyEmail && human.emailNotifications) {
        sendJobOfferUpdatedEmail({
          humanName: human.name,
          humanEmail: notifyEmail,
          humanId: human.id,
          jobTitle: updated.title,
          jobDescription: updated.description,
          priceUsdc: updated.priceUsdc.toNumber(),
          agentName: displayName,
          category: updated.category || undefined,
          language: human.preferredLanguage,
          jobDetailUrl,
        }).catch((err) => logger.error({ err }, 'Updated offer email notification failed'));
      }

      if (human.telegramChatId) {
        sendJobOfferUpdatedTelegram({
          chatId: human.telegramChatId,
          humanName: human.name,
          jobTitle: updated.title,
          jobDescription: updated.description,
          priceUsdc: updated.priceUsdc.toNumber(),
          agentName: displayName,
          dashboardUrl: jobDetailUrl,
        }).catch((err) => logger.error({ err }, 'Updated offer Telegram notification failed'));
      }
    }

    res.json({
      id: updated.id,
      status: updated.status,
      updateCount: updated.updateCount,
      message: 'Offer updated successfully.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get jobs for authenticated human
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;

    const where: any = { humanId: req.userId };
    if (status) {
      where.status = status;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        review: true,
        registeredAgent: {
          select: { id: true, name: true, description: true, websiteUrl: true, domainVerified: true },
        },
        _count: { select: { messages: true } },
      },
    });

    res.json(jobs);
  } catch (error) {
    logger.error({ err: error }, 'Get jobs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human accepts a job offer
router.patch('/:id/accept', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot accept job in ${job.status} status` });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // Fire webhook with contact info on acceptance
    if (job.callbackUrl) {
      const human = await prisma.human.findUnique({
        where: { id: job.humanId },
        select: {
          name: true,
          contactEmail: true,
          email: true,
          telegram: true,
          whatsapp: true,
          signal: true,
        },
      });
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.accepted',
        {
          humanName: human?.name,
          contact: {
            email: human?.contactEmail || human?.email || null,
            telegram: human?.telegram || null,
            whatsapp: human?.whatsapp || null,
            signal: human?.signal || null,
          },
        },
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Job accepted. Price is now locked. Waiting for payment.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Accept job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human rejects a job offer
router.patch('/:id/reject', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot reject job in ${job.status} status` });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'REJECTED' },
    });

    // Fire webhook on rejection
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.rejected',
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Job rejected.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Reject job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark job as paid (called by agent after sending payment)
// Performs on-chain verification of USDC transfer
router.patch('/:id/paid', async (req, res) => {
  try {
    const data = markPaidSchema.parse(req.body);

    // Fetch job with human's wallets included for verification
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: {
            wallets: {
              select: {
                address: true,
                network: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // CRITICAL: Only accept payment for ACCEPTED jobs
    if (job.status !== 'ACCEPTED') {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: `Job must be in ACCEPTED status. Current status: ${job.status}`,
        hint: 'The human must accept the job before payment can be recorded.',
      });
    }

    // Get wallet addresses for the payment network
    // Match wallets where network matches the payment network (case-insensitive)
    const networkLower = data.paymentNetwork.toLowerCase();
    const recipientWallets = job.human.wallets
      .filter((w) => w.network.toLowerCase() === networkLower || w.network.toLowerCase() === 'ethereum')
      .map((w) => w.address);

    if (recipientWallets.length === 0) {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: `Human has no registered wallets for network: ${data.paymentNetwork}`,
        hint: 'The human must register a wallet for this network before receiving payments.',
      });
    }

    // Verify payment on-chain
    const agreedPrice = job.priceUsdc.toNumber();
    const token = (data.paymentToken?.toUpperCase() || 'USDC') as SupportedToken;
    const verification = await verifyUsdcPayment({
      txHash: data.paymentTxHash,
      network: data.paymentNetwork,
      recipientWallets,
      expectedAmount: agreedPrice,
      jobId: job.id,
      token,
    });

    // Payment verified! Update job status
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PAID',
        paymentTxHash: data.paymentTxHash,
        paymentNetwork: networkLower,
        paymentAmount: new Decimal(verification.amount),
        paidAt: new Date(),
      },
    });

    // Fire webhook on payment
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.paid',
        {
          payment: {
            txHash: verification.txHash,
            network: verification.network,
            token: verification.token,
            amount: verification.amount,
          },
        },
      );
    }

    // Track payment received in PostHog (pass req for country geolocation)
    trackServerEvent(job.humanId, 'payment_received', {
      jobId: job.id,
      amount: verification.amount,
      network: verification.network,
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Payment verified and recorded. Work can begin.',
      verification: {
        txHash: verification.txHash,
        network: verification.network,
        token: verification.token,
        from: verification.from,
        to: verification.to,
        amount: verification.amount,
        confirmations: verification.confirmations,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if (error instanceof PaymentVerificationError) {
      return res.status(400).json(error.toResponse());
    }
    logger.error({ err: error }, 'Mark paid error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human marks job as completed
router.patch('/:id/complete', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'PAID') {
      return res.status(400).json({ error: `Cannot complete job in ${job.status} status` });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Fire webhook on completion
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.completed',
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Job marked as completed. Review is now unlocked.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Complete job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent leaves a review (only for COMPLETED jobs)
router.post('/:id/review', async (req, res) => {
  try {
    const data = reviewSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { review: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // CRITICAL: Only allow reviews for COMPLETED jobs
    if (job.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Review rejected',
        reason: `Cannot review job in ${job.status} status`,
        hint: 'Reviews are only allowed after the job is marked as completed.',
      });
    }

    // Check if already reviewed
    if (job.review) {
      return res.status(400).json({ error: 'Job has already been reviewed' });
    }

    const review = await prisma.review.create({
      data: {
        jobId: job.id,
        humanId: job.humanId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    res.status(201).json({
      id: review.id,
      rating: review.rating,
      message: 'Review submitted successfully.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create review error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Message rate limiter: 10 messages per minute
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many messages. Limit: 10 per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Schema for sending a message
const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// Send a message on a job
router.post('/:id/messages', messageRateLimiter, authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const data = messageSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Auth check: human must own the job, or agent must have created it
    if (req.senderType === 'human' && job.humanId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (req.senderType === 'agent' && job.registeredAgentId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Status check: only allow on non-terminal statuses
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'PAID'];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({ error: `Cannot send messages on ${job.status} jobs` });
    }

    const message = await prisma.jobMessage.create({
      data: {
        jobId: job.id,
        senderType: req.senderType!,
        senderId: req.senderId!,
        senderName: req.senderName!,
        content: data.content,
      },
    });

    // If sender is human, fire job.message webhook so agent can auto-reply
    if (req.senderType === 'human' && job.callbackUrl) {
      fireWebhook(
        { ...job, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.message',
        {
          message: {
            id: message.id,
            senderType: message.senderType,
            senderName: message.senderName,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          },
        },
      );
    }

    // If sender is agent, notify the human via email/Telegram
    if (req.senderType === 'agent') {
      const human = await prisma.human.findUnique({
        where: { id: job.humanId },
        select: {
          id: true,
          name: true,
          email: true,
          contactEmail: true,
          emailVerified: true,
          emailNotifications: true,
          telegramChatId: true,
          preferredLanguage: true,
        },
      });

      if (human) {
        const jobDetailUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/${job.id}`;
        const notifyEmail = human.contactEmail || human.email;

        if (notifyEmail && human.emailNotifications) {
          sendJobMessageEmail({
            humanName: human.name,
            humanEmail: notifyEmail,
            humanId: human.id,
            agentName: req.senderName!,
            messageContent: data.content,
            jobTitle: job.title,
            jobDetailUrl,
            language: human.preferredLanguage ?? undefined,
          }).catch((err) => logger.error({ err }, 'Agent message email notification failed'));
        }

        if (human.telegramChatId) {
          const preview = data.content.length > 200 ? data.content.slice(0, 200) + '...' : data.content;
          sendTelegramMessage({
            chatId: human.telegramChatId,
            text: `<b>New message from ${req.senderName!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\n\nOn: ${job.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n\n"${preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"\n\n<a href="${jobDetailUrl}">View &amp; Reply</a>`,
            parseMode: 'HTML',
          }).catch((err) => logger.error({ err }, 'Agent message Telegram notification failed'));
        }
      }
    }

    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Send message error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a job
router.get('/:id/messages', authenticateEither, async (req: EitherAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Auth check: human must own the job, or agent must have created it
    if (req.senderType === 'human' && job.humanId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (req.senderType === 'agent' && job.registeredAgentId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const messages = await prisma.jobMessage.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error) {
    logger.error({ err: error }, 'Get messages error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reviews for a human (public)
router.get('/human/:humanId/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { humanId: req.params.humanId },
      include: {
        job: {
          select: {
            title: true,
            category: true,
            agentName: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const stats = {
      totalReviews: reviews.length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
      completedJobs: await prisma.job.count({
        where: { humanId: req.params.humanId, status: 'COMPLETED' },
      }),
    };

    res.json({ stats, reviews });
  } catch (error) {
    logger.error({ err: error }, 'Get reviews error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
