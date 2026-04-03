import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { requireActiveAgent } from '../middleware/requireActiveAgent.js';
import { authenticateEither, EitherAuthRequest } from '../middleware/eitherAuth.js';
import { requireActiveIfAgent } from '../middleware/requireActiveAgent.js';
import { x402PaymentCheck, X402Request } from '../middleware/x402PaymentCheck.js';
import { requireActiveOrPaid } from '../middleware/requireActiveOrPaid.js';
import { isX402Enabled, X402_PRICES, buildPaymentRequiredResponse } from '../lib/x402.js';
import { sendJobOfferEmail, sendJobOfferUpdatedEmail, sendJobMessageEmail } from '../lib/email.js';
import { sendJobOfferTelegram, sendJobOfferUpdatedTelegram, sendTelegramMessage } from '../lib/telegram.js';
import { sendWhatsAppNotification, isWhatsAppEnabled } from '../lib/whatsapp.js';
import { sendJobOfferPush, sendJobOfferUpdatedPush, sendJobMessagePush } from '../lib/push.js';
import {
  verifyUsdcPayment,
  PaymentVerificationError,
  SUPPORTED_NETWORKS,
  SUPPORTED_TOKENS,
  type SupportedToken,
  verifyFlow,
  isFlowActive,
  getSuperTokenAddress,
  usdcPerIntervalToFlowRate,
  flowRateToUsdcPerInterval,
  calculateTotalStreamed,
  getFlowInfo,
  SUPER_TOKEN_ADDRESSES,
  CFA_V1_FORWARDER,
} from '../lib/blockchain/index.js';
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { isAllowedUrl, fireWebhook, deliverWebhook } from '../lib/webhook.js';
import { convertToUsd } from '../lib/exchangeRates.js';
import { starRatingToERC8004Value, buildFeedbackJSON, hashFeedbackJSON } from '../lib/erc8004.js';
import { queueModeration, isModerationEnabled } from '../lib/moderation.js';

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

// Valid payment preferences
const VALID_PAYMENT_PREFERENCES = ['UPFRONT', 'ESCROW', 'UPON_COMPLETION', 'STREAM'];

// Schema for creating a job offer (called by agents)
const createJobSchema = z.object({
  humanId: z.string().min(1, 'humanId is required'),
  agentId: z.string().min(1),
  agentName: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().max(100).optional(),
  priceUsdc: z.number().positive().max(999999999),
  // Payment mode & timing
  paymentMode: z.enum(['ONE_TIME', 'STREAM', 'ESCROW']).optional().default('ONE_TIME'),
  paymentTiming: z.enum(['upfront', 'upon_completion']).optional().default('upfront'),
  // Escrow-specific fields (required when paymentMode=ESCROW)
  escrowArbitratorAddress: z.string().optional(),
  // Stream-specific fields (required when paymentMode=STREAM)
  streamMethod: z.enum(['SUPERFLUID', 'MICRO_TRANSFER']).optional(),
  streamInterval: z.enum(['HOURLY', 'DAILY', 'WEEKLY']).optional(),
  streamRateUsdc: z.number().positive().optional(),
  streamMaxTicks: z.number().int().positive().optional(),
  streamGraceTicks: z.number().int().min(1).optional(),
  // Agent location for distance filtering
  agentLat: z.number().min(-90).max(90).optional(),
  agentLng: z.number().min(-180).max(180).optional(),
  // Webhook callback
  callbackUrl: z.string().url().optional(),
  callbackSecret: z.string().min(16).max(256).optional(),
});

// Schema for updating a job offer (called by agents)
const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z.string().max(100).optional(),
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

// Tier-based offer limits with per-tier windows. Accepted jobs don't count toward the limit.
const TIER_OFFER_CONFIG: Record<string, { limit: number; windowMs: number }> = {
  BASIC: { limit: 1, windowMs: 48 * 60 * 60 * 1000 }, // 1 per 2 days
  PRO:   { limit: 15, windowMs: 24 * 60 * 60 * 1000 }, // 15 per day
};

// Create a job offer (requires registered + activated agent, or x402 payment)
router.post('/', ipRateLimiter, x402PaymentCheck('job_offer'), authenticateAgent, requireActiveOrPaid, async (req: X402Request, res) => {
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

    // Tier-based rate limit — skipped for x402 paid requests
    const config = TIER_OFFER_CONFIG[agent.activationTier] || TIER_OFFER_CONFIG.BASIC;
    let recentOfferCount = 0;

    if (!req.x402Paid) {
      const windowStart = new Date(Date.now() - config.windowMs);
      recentOfferCount = await prisma.job.count({
        where: {
          registeredAgentId: agent.id,
          createdAt: { gte: windowStart },
          status: { notIn: ['ACCEPTED', 'COMPLETED', 'PAID'] },
        },
      });

      if (recentOfferCount >= config.limit) {
        const windowHours = config.windowMs / (60 * 60 * 1000);
        const windowLabel = windowHours >= 48 ? `${windowHours / 24} days` : `${windowHours} hours`;
        const tierMsg = `Your ${agent.activationTier} tier allows ${config.limit} job offer(s) per ${windowLabel}. Accepted offers don't count toward this limit.`;
        const price = X402_PRICES.job_offer;

        if (isX402Enabled()) {
          const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const paymentRequired = await buildPaymentRequiredResponse('job_offer', resourceUrl);
          res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
          return res.status(402).json({
            ...paymentRequired,
            error: 'Payment required',
            message: `${tierMsg} To proceed, pay $${price} USDC per request via x402, or upgrade to PRO for higher limits.`,
            tier: agent.activationTier,
            limit: config.limit,
            x402: {
              price: `$${price}`,
              currency: 'USDC',
              description: 'Retry this exact request with an X-Payment header to pay per use and bypass the rate limit.',
            },
          });
        }

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `${tierMsg} Upgrade to PRO for higher limits.`,
          tier: agent.activationTier,
          limit: config.limit,
          retryAfter: windowLabel,
        });
      }
    }

    // Validate escrow fields when mode is ESCROW
    if (data.paymentMode === 'ESCROW') {
      if (!process.env.ESCROW_ENABLED) {
        return res.status(400).json({ error: 'Escrow payments are not enabled' });
      }
      if (!data.escrowArbitratorAddress) {
        return res.status(400).json({ error: 'escrowArbitratorAddress is required when paymentMode is ESCROW' });
      }
    }

    // Validate stream fields when mode is STREAM
    if (data.paymentMode === 'STREAM') {
      if (!data.streamMethod) {
        return res.status(400).json({ error: 'streamMethod is required when paymentMode is STREAM' });
      }
      if (!data.streamInterval) {
        return res.status(400).json({ error: 'streamInterval is required when paymentMode is STREAM' });
      }
      if (!data.streamRateUsdc) {
        return res.status(400).json({ error: 'streamRateUsdc is required when paymentMode is STREAM' });
      }
    }

    // Verify human exists, is email-verified, and get contact info + filter settings
    // Accept either CUID or username as humanId
    const isCuid = data.humanId.length >= 20 && /^[a-z0-9]+$/.test(data.humanId);
    const human = await prisma.human.findFirst({
      where: isCuid ? { id: data.humanId } : { username: data.humanId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        email: true,
        emailVerified: true,
        isAvailable: true,
        telegramChatId: true,
        telegramNotifications: true,
        whatsapp: true,
        whatsappVerified: true,
        whatsappNotifications: true,
        whatsappLastInboundAt: true,
        preferredLanguage: true,
        emailNotifications: true,
        pushNotifications: true,
        paymentPreferences: true,
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

    if (!human.emailVerified && !human.whatsappVerified) {
      return res.status(400).json({
        error: 'Human not available',
        message: 'This human has not verified their identity and cannot receive job offers.',
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

    // Check payment preference compatibility
    if (data.paymentMode === 'STREAM' && !human.paymentPreferences.includes('STREAM')) {
      return res.status(400).json({
        error: 'Payment preference mismatch',
        code: 'STREAM_NOT_ACCEPTED',
        message: 'This human does not accept stream payments. Check their paymentPreferences.',
      });
    }
    if (data.paymentMode === 'ONE_TIME' && data.paymentTiming === 'upon_completion'
        && !human.paymentPreferences.includes('UPON_COMPLETION')) {
      return res.status(400).json({
        error: 'Payment preference mismatch',
        code: 'UPON_COMPLETION_NOT_ACCEPTED',
        message: 'This human does not accept upon-completion payments.',
      });
    }

    const job = await prisma.job.create({
      data: {
        humanId: human.id,
        agentId: data.agentId,
        agentName: data.agentName || agent.name,
        registeredAgentId: agent.id,
        title: data.title,
        description: data.description,
        category: data.category,
        priceUsdc: new Decimal(data.priceUsdc),
        paymentMode: data.paymentMode,
        moderationStatus: 'pending',
        paymentTiming: data.paymentMode === 'ONE_TIME' ? data.paymentTiming : null,
        // Stream fields
        ...(data.paymentMode === 'STREAM' ? {
          streamMethod: data.streamMethod,
          streamInterval: data.streamInterval,
          streamRateUsdc: data.streamRateUsdc ? new Decimal(data.streamRateUsdc) : undefined,
          streamMaxTicks: data.streamMaxTicks,
          streamGraceTicks: data.streamGraceTicks ?? 1,
        } : {}),
        // Escrow fields
        ...(data.paymentMode === 'ESCROW' ? {
          escrowStatus: 'PENDING_DEPOSIT' as const,
          escrowArbitratorAddress: data.escrowArbitratorAddress,
          escrowDisputeWindow: data.priceUsdc < 25 ? 86400 : data.priceUsdc < 100 ? 172800 : 259200,
        } : {}),
        callbackUrl: data.callbackUrl,
        callbackSecret: data.callbackSecret,
        status: 'PENDING',
      },
    });

    // Queue content moderation for the job posting
    queueModeration('job_posting', job.id).catch((err) =>
      logger.error({ err }, 'Failed to queue job moderation')
    );

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
    if (human.telegramChatId && human.telegramNotifications) {
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

    // Send WhatsApp notification (async, don't block response)
    if (isWhatsAppEnabled() && human.whatsapp && human.whatsappVerified && human.whatsappNotifications) {
      const waBody = `New job offer: ${data.title}\nFrom: ${displayName}\nPay: $${data.priceUsdc} USDC\n\n${data.description.slice(0, 200)}${data.description.length > 200 ? '...' : ''}\n\nView: ${jobDetailUrl}`;
      sendWhatsAppNotification({
        to: human.whatsapp,
        humanId: human.id,
        lastInboundAt: human.whatsappLastInboundAt,
        body: waBody,
        jobId: job.id,
        templateType: 'offer',
        templateVars: { '1': data.title, '2': `$${data.priceUsdc} USDC` },
        prisma,
      }).catch((err) => logger.error({ err }, 'WhatsApp notification failed'));
    }

    // Send push notification (async, don't block response)
    if (human.pushNotifications) {
      sendJobOfferPush(human.id, job.id).catch((err) => logger.error({ err }, 'Push notification failed'));
    }

    // Log x402 payment if this was a paid request
    if (req.x402Paid && req.x402PaymentPayload) {
      prisma.x402Payment.create({
        data: {
          agentId: agent.id,
          resourceType: 'job_offer',
          resourceId: job.id,
          amountUsd: X402_PRICES.job_offer,
          network: req.x402MatchedRequirements?.network || 'eip155:8453',
          paymentPayload: req.x402PaymentPayload as any,
          settled: true,
          agentIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
        },
      }).catch((err) => logger.error({ err }, 'Failed to log x402 payment'));
    }

    const windowHours = config.windowMs / (60 * 60 * 1000);
    const windowLabel = windowHours >= 48 ? `${windowHours / 24} days` : `${windowHours} hours`;

    // When moderation is disabled (e.g. dev), queueModeration auto-approves synchronously.
    // Reflect the actual state in the response so agents don't poll unnecessarily.
    const moderationActive = isModerationEnabled();

    res.status(201).json({
      id: job.id,
      status: job.status,
      moderationStatus: moderationActive ? 'pending' : 'approved',
      message: moderationActive
        ? 'Job offer created and under review. The human will be notified once approved.'
        : 'Job offer created. Waiting for human to accept.',
      ...(moderationActive ? {
        moderation: {
          status: 'pending',
          estimatedSeconds: 30,
          poll: `GET /api/jobs/${job.id}`,
          pollIntervalSeconds: 15,
          webhookEvent: 'job.moderation_complete',
        },
      } : {}),
      ...(req.x402Paid ? { paidVia: 'x402' } : {
        rateLimit: {
          remaining: config.limit - recentOfferCount - 1,
          resetIn: windowLabel,
          tier: agent.activationTier,
        },
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'A job with these details already exists', code: 'DUPLICATE' });
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
          select: { id: true, name: true, paymentPreferences: true },
        },
        review: true,
        registeredAgent: {
          select: { id: true, name: true, description: true, websiteUrl: true, domainVerified: true },
        },
        _count: { select: { messages: true } },
        ...(true ? {
          streamTicks: {
            orderBy: { tickNumber: 'desc' as const },
            take: 10,
            select: {
              id: true,
              tickNumber: true,
              status: true,
              expectedAt: true,
              amount: true,
              verifiedAt: true,
              txHash: true,
            },
          },
        } : {}),
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Build stream summary for stream jobs
    let streamSummary = undefined;
    if (job.paymentMode === 'STREAM') {
      streamSummary = {
        method: job.streamMethod,
        interval: job.streamInterval,
        rateUsdc: job.streamRateUsdc?.toString(),
        flowRate: job.streamFlowRate,
        network: job.streamNetwork,
        token: job.streamToken,
        superToken: job.streamSuperToken,
        senderAddress: job.streamSenderAddress,
        startedAt: job.streamStartedAt,
        pausedAt: job.streamPausedAt,
        endedAt: job.streamEndedAt,
        tickCount: job.streamTickCount,
        missedTicks: job.streamMissedTicks,
        totalPaid: job.streamTotalPaid?.toString(),
        maxTicks: job.streamMaxTicks,
        graceTicks: job.streamGraceTicks,
        recentTicks: job.streamTicks,
      };
    }

    // Strip callbackSecret from response to prevent leaking
    const { callbackSecret, streamTicks, ...safeJob } = job;

    // Add human-readable moderation hint for API consumers (agents, frontends)
    const moderationHints: Record<string, string> = {
      pending: 'Content is under review. This typically completes within a few minutes.',
      approved: 'Content approved. Visible to the human.',
      rejected: 'Content was flagged by moderation and is not visible to the human.',
    };
    const moderationHint = moderationHints[safeJob.moderationStatus] || '';

    res.json({ ...safeJob, _moderationHint: moderationHint, ...(streamSummary ? { streamSummary } : {}) });
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
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
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
        telegramNotifications: true,
        whatsapp: true,
        whatsappVerified: true,
        whatsappNotifications: true,
        whatsappLastInboundAt: true,
        pushNotifications: true,
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

      if (human.telegramChatId && human.telegramNotifications) {
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

      if (isWhatsAppEnabled() && human.whatsapp && human.whatsappVerified && human.whatsappNotifications) {
        const waBody = `Updated job offer: ${updated.title}\nFrom: ${displayName}\nPay: $${updated.priceUsdc.toNumber()} USDC\n\n${updated.description.slice(0, 200)}${updated.description.length > 200 ? '...' : ''}\n\nView: ${jobDetailUrl}`;
        sendWhatsAppNotification({
          to: human.whatsapp,
          humanId: human.id,
          lastInboundAt: human.whatsappLastInboundAt,
          body: waBody,
          jobId: updated.id,
          templateType: 'offer',
          templateVars: { '1': updated.title, '2': `$${updated.priceUsdc.toNumber()} USDC` },
          prisma,
        }).catch((err) => logger.error({ err }, 'Updated offer WhatsApp notification failed'));
      }

      // Push notification
      if (human.pushNotifications) {
        sendJobOfferUpdatedPush(human.id, updated.id).catch((err) => logger.error({ err }, 'Updated offer push notification failed'));
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

// Valid job statuses for filtering
const VALID_JOB_STATUSES = ['PENDING', 'ACCEPTED', 'PAYMENT_CLAIMED', 'PAID', 'STREAMING', 'PAUSED', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED'];

// Get jobs for authenticated human
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;

    const where: any = { humanId: req.userId };
    if (status) {
      if (!VALID_JOB_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Valid statuses: ${VALID_JOB_STATUSES.join(', ')}`,
        });
      }
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
    // Use transaction to prevent race condition where two users accept the same job
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: req.params.id },
      });

      if (!job) {
        return null;
      }

      if (job.humanId !== req.userId) {
        return null;
      }

      if (job.status !== 'PENDING') {
        return null;
      }

      // Compute response time (minutes from creation to first human action)
      const responseTimeMinutes = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60);

      return tx.job.update({
        where: { id: job.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          lastActionBy: 'HUMAN',
          responseTimeMinutes: Math.round(responseTimeMinutes * 10) / 10,
        },
      });
    });

    if (!result) {
      return res.status(409).send({ error: 'Job already accepted or cancelled' });
    }

    const updated = result;

    // Fire webhook with contact info on acceptance
    if (updated.callbackUrl) {
      const human = await prisma.human.findUnique({
        where: { id: updated.humanId },
        select: {
          name: true,
          contactEmail: true,
          email: true,
          telegram: true,
          whatsapp: true,
          signal: true,
        },
      });
      const { callbackSecret, ...safeJob } = updated;
      fireWebhook(
        { ...safeJob, callbackUrl: updated.callbackUrl, callbackSecret: updated.callbackSecret },
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

    // Fire agent.funding_needed webhook (async, non-blocking) if USDC balance is insufficient
    // The agent can ignore this if they plan to use fiat direct payment
    if (updated.registeredAgentId) {
      // Fire-and-forget: check balance and notify agent
      (async () => {
        try {
          const agent = await prisma.agent.findUnique({
            where: { id: updated.registeredAgentId! },
            select: { webhookUrl: true, webhookSecret: true, wallets: { orderBy: { createdAt: 'asc' as const }, take: 1, select: { address: true, network: true } } },
          });
          const firstWallet = agent?.wallets?.[0];
          if (!agent?.webhookUrl || !firstWallet) return;

          // Lazy-import to avoid circular deps
          const { getPublicClient, getTokenAddress, TOKEN_CONFIGS } = await import('../lib/blockchain/chains.js');
          const { formatUnits } = await import('viem');

          const network = firstWallet.network || 'base';
          const client = getPublicClient(network);
          const usdcAddr = getTokenAddress('USDC', network);
          if (!client || !usdcAddr) return;

          const balanceRaw = await client.readContract({
            address: usdcAddr,
            abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
            functionName: 'balanceOf',
            args: [firstWallet.address as `0x${string}`],
          });
          const balance = parseFloat(formatUnits(balanceRaw as bigint, TOKEN_CONFIGS.USDC.decimals));
          const required = parseFloat(updated.priceUsdc.toString());

          if (balance < required) {
            deliverWebhook(agent.webhookUrl, {
              event: 'agent.funding_needed',
              agentId: updated.registeredAgentId,
              jobId: updated.id,
              requiredAmount: required.toFixed(2),
              currentBalance: balance.toFixed(2),
              currency: 'USDC',
              network,
              timestamp: new Date().toISOString(),
            }, agent.webhookSecret);
          }
        } catch (err) {
          logger.error({ err, agentId: updated.registeredAgentId, jobId: updated.id, network: 'base' }, 'funding_needed webhook failed — agent may not know they need funding');
        }
      })();
    }

    trackServerEvent(req.userId!, 'job_accepted', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      responseTimeMinutes: updated.responseTimeMinutes,
      time_to_response_ms: Date.now() - new Date(updated.createdAt).getTime(),
      priceUsdc: updated.priceUsdc?.toString(),
      category: (updated as any).category,
    }, req);

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

    // Compute response time (minutes from creation to first human action)
    const rejectResponseTime = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'REJECTED',
        lastActionBy: 'HUMAN',
        responseTimeMinutes: Math.round(rejectResponseTime * 10) / 10,
      },
    });

    // Fire webhook on rejection
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.rejected',
      );
    }

    trackServerEvent(req.userId!, 'job_rejected', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      responseTimeMinutes: updated.responseTimeMinutes,
      time_to_response_ms: Date.now() - new Date(updated.createdAt).getTime(),
      priceUsdc: updated.priceUsdc?.toString(),
      category: (updated as any).category,
    }, req);

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

    // Fetch job with human's VERIFIED wallets + agent wallet info for payment verification
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: {
            wallets: {
              where: { verified: true },
              select: {
                address: true,
                network: true,
              },
            },
          },
        },
        registeredAgent: {
          select: {
            wallets: {
              where: { verified: true },
              select: { address: true },
            },
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Accept payment for ACCEPTED jobs (upfront flow) or COMPLETED jobs (upon-completion flow)
    if (job.status !== 'ACCEPTED' && job.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: `Job must be in ACCEPTED or COMPLETED status. Current status: ${job.status}`,
        hint: 'The human must accept the job before payment can be recorded.',
      });
    }

    // For upon-completion: only accept payment after job is completed
    if (job.paymentTiming === 'upon_completion' && job.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: 'This is an upon-completion job. Payment is accepted only after the human marks work as done.',
        hint: 'Wait for the job status to be COMPLETED before paying.',
      });
    }

    // Get wallet addresses for the payment network
    const networkLower = data.paymentNetwork.toLowerCase();

    // Primary: exact network match
    const exactMatch = job.human.wallets
      .filter((w) => w.network.toLowerCase() === networkLower)
      .map((w) => w.address);

    // Fallback for pre-existing single-network wallets:
    // any registered EVM address works on any EVM chain
    const recipientWallets = exactMatch.length > 0
      ? exactMatch
      : [...new Set(job.human.wallets.map((w) => w.address.toLowerCase()))];

    if (recipientWallets.length === 0) {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: `Human has no registered wallets for network: ${data.paymentNetwork}`,
        hint: 'The human must register a wallet for this network before receiving payments.',
      });
    }

    // Track payment initiation
    trackServerEvent(job.humanId, 'payment_initiated', {
      jobId: job.id,
      network: data.paymentNetwork,
      amount: job.priceUsdc.toNumber(),
    }, req);

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

    // Payment verified! Compute sender match (soft signal, never blocks payment)
    // Check if the on-chain sender matches ANY of the agent's verified wallets
    let senderMatch: boolean | null = null;
    if (job.registeredAgent?.wallets && job.registeredAgent.wallets.length > 0) {
      const fromLower = verification.from.toLowerCase();
      senderMatch = job.registeredAgent.wallets.some(w => w.address.toLowerCase() === fromLower);
    }

    // Update job status
    // For upon-completion flow: status goes to PAID (terminal — both milestones met)
    // For upfront flow: status goes to PAID (intermediate — work not yet done)
    const newStatus = 'PAID';
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: newStatus,
        paymentTxHash: data.paymentTxHash,
        paymentNetwork: networkLower,
        paymentAmount: new Decimal(verification.amount),
        paymentFromAddress: verification.from.toLowerCase(),
        senderMatch,
        paidAt: new Date(),
        lastActionBy: 'AGENT',
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
      logger.warn({ err: error, jobId: req.params.id }, 'Payment verification failed');
      trackServerEvent('anonymous', 'payment_failed', {
        jobId: req.params.id,
        reason: error.message,
      }, req);
      return res.status(400).json(error.toResponse());
    }
    logger.error({ err: error }, 'Mark paid error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human marks job as completed (or submits for review on upon_completion jobs)
router.patch('/:id/complete', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { human: { select: { id: true, name: true, paymentPreferences: true } } },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Determine if this is an upon-completion flow (needs SUBMITTED review step)
    const isUponCompletion = job.paymentTiming === 'upon_completion'
      || job.human.paymentPreferences.includes('UPON_COMPLETION');

    // For stream jobs, allow completion from STREAMING or PAUSED
    if (job.paymentMode === 'STREAM') {
      if (job.status !== 'STREAMING' && job.status !== 'PAUSED') {
        return res.status(400).json({ error: `Cannot complete stream job in ${job.status} status` });
      }
    } else if (isUponCompletion && job.status === 'SUBMITTED') {
      // Idempotency: if already SUBMITTED, return current state
      return res.json({ id: job.id, status: job.status, message: 'Work already submitted for review.' });
    } else if (isUponCompletion && job.status === 'ACCEPTED') {
      // Upon-completion flow: ACCEPTED → SUBMITTED (requires evidence)
      const body = z.object({
        message: z.string().min(20, 'Please describe what you did in at least 20 characters').max(5000),
      }).parse(req.body);

      // Post evidence to chat before status update
      await prisma.jobMessage.create({
        data: {
          jobId: job.id,
          senderType: 'human',
          senderId: job.humanId,
          senderName: job.human.name || 'Human',
          content: body.message,
        },
      });

      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          lastActionBy: 'HUMAN',
        },
      });

      // Track work submission
      trackServerEvent(req.userId!, 'work_submitted', {
        jobId: updated.id,
        agentId: updated.registeredAgentId || updated.agentId,
        time_since_accepted_ms: updated.acceptedAt ? Date.now() - new Date(updated.acceptedAt).getTime() : null,
      }, req);

      if (updated.callbackUrl) {
        fireWebhook(
          { ...updated, callbackUrl: updated.callbackUrl, callbackSecret: updated.callbackSecret },
          'job.submitted',
        );
      }

      return res.json({
        id: updated.id,
        status: updated.status,
        message: 'Work submitted for review.',
      });
    } else {
      // Standard flow: PAID → COMPLETED
      if (job.status !== 'PAID') {
        return res.status(400).json({ error: `Cannot complete job in ${job.status} status` });
      }
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastActionBy: 'HUMAN',
      },
    });

    // Fire webhook on completion
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.completed',
      );
    }

    trackServerEvent(req.userId!, 'job_completed', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      completedBy: 'human',
      time_to_complete_ms: Date.now() - new Date(updated.createdAt).getTime(),
      priceUsdc: updated.priceUsdc?.toString(),
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Job marked as completed. Review is now unlocked.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Complete job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== AGENT APPROVAL FLOW (for SUBMITTED jobs) =====

// Agent approves submitted work → SUBMITTED → COMPLETED
router.patch('/:id/approve-completion', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the agent on this job can approve
    if (req.senderType !== 'agent' || req.senderId !== job.registeredAgentId) {
      return res.status(403).json({ error: 'Only the assigned agent can approve completion' });
    }

    // Idempotency: if already COMPLETED (or later), return current state
    if (job.status === 'COMPLETED' || job.status === 'PAID') {
      return res.json({ id: job.id, status: job.status, message: 'Work already approved.' });
    }

    if (job.status !== 'SUBMITTED') {
      return res.status(400).json({ error: `Cannot approve completion for job in ${job.status} status` });
    }

    // For escrow jobs, redirect to the escrow mark-complete endpoint
    if (job.paymentMode === 'ESCROW' && job.escrowStatus === 'FUNDED' && job.escrowJobIdHash) {
      const { markCompleteOnChain } = await import('../lib/blockchain/escrow.js');
      const now = new Date();
      const disputeDeadline = new Date(now.getTime() + (job.escrowDisputeWindow || 259200) * 1000);

      const txHash = await markCompleteOnChain(job.escrowJobIdHash as `0x${string}`);
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          escrowStatus: 'COMPLETED_ONCHAIN',
          escrowCompletedAt: now,
          escrowDisputeDeadline: disputeDeadline,
          completedAt: now,
          lastActionBy: 'AGENT',
        },
      });

      if (job.callbackUrl) {
        fireWebhook(
          { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
          'job.escrow_completed',
        );
      }

      trackServerEvent(req.senderId!, 'job_completed', {
        jobId: updated.id,
        agentId: updated.registeredAgentId || updated.agentId,
        completedBy: 'agent_approved',
        escrow: true,
      }, req);

      return res.json({
        id: updated.id,
        status: updated.status,
        escrowStatus: updated.escrowStatus,
        escrowDisputeDeadline: updated.escrowDisputeDeadline,
        markCompleteTxHash: txHash,
        message: `Work approved. Funds auto-release at ${disputeDeadline.toISOString()} unless disputed.`,
      });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastActionBy: 'AGENT',
      },
    });

    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.completed',
      );
    }

    trackServerEvent(req.senderId!, 'job_completed', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      completedBy: 'agent_approved',
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Work approved. Job completed.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Approve completion error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent requests revision → SUBMITTED → ACCEPTED
router.patch('/:id/request-revision', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const body = z.object({
      reason: z.string().min(1, 'Revision reason is required').max(1000),
    }).parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { registeredAgent: { select: { name: true } } },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the agent on this job can request revision
    if (req.senderType !== 'agent' || req.senderId !== job.registeredAgentId) {
      return res.status(403).json({ error: 'Only the assigned agent can request revision' });
    }

    if (job.status !== 'SUBMITTED') {
      return res.status(400).json({ error: `Cannot request revision for job in ${job.status} status` });
    }

    // Post revision reason as agent message in chat
    await prisma.jobMessage.create({
      data: {
        jobId: job.id,
        senderType: 'agent',
        senderId: job.registeredAgentId!,
        senderName: job.registeredAgent?.name || job.agentName || 'Agent',
        content: body.reason,
      },
    });

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'ACCEPTED',
        submittedAt: null,
        lastActionBy: 'AGENT',
      },
    });

    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.revision_requested',
        { reason: body.reason },
      );
    }

    trackServerEvent(req.senderId!, 'job_revision_requested', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      humanId: updated.humanId,
      time_since_submission_ms: updated.submittedAt ? Date.now() - new Date(updated.submittedAt).getTime() : null,
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Revision requested.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Request revision error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== OFF-CHAIN PAYMENT CLAIM FLOW =====

const claimPaymentSchema = z.object({
  method: z.string().min(1).max(100),  // "paypal", "venmo", "wise", "bank_transfer", etc.
  note: z.string().max(1000).optional(), // Reference number, receipt link, freeform proof
});

// Agent claims they sent an off-chain payment (PayPal, Venmo, Wise, bank transfer, etc.)
// ACCEPTED → PAYMENT_CLAIMED (upfront) or COMPLETED → PAYMENT_CLAIMED (upon-completion)
router.patch('/:id/claim-payment', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = claimPaymentSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Must be the agent who created the offer
    if (job.registeredAgentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Not authorized. Only the offering agent can claim payment.' });
    }

    // Prevent double path: if on-chain payment already recorded, reject
    if (job.paymentTxHash) {
      return res.status(400).json({
        error: 'On-chain payment already recorded',
        hint: 'This job was paid via crypto. Off-chain claim is not allowed.',
      });
    }

    // Prevent re-claim: only one active claim per job
    if (job.paymentClaimedAt) {
      return res.status(400).json({
        error: 'Payment already claimed',
        hint: 'A payment claim is already pending. Wait for the human to confirm or deny.',
      });
    }

    // Allowed from: ACCEPTED (upfront) or COMPLETED (upon-completion)
    const allowedStatuses = ['ACCEPTED', 'COMPLETED'];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot claim payment',
        reason: `Job must be in ACCEPTED or COMPLETED status. Current: ${job.status}`,
      });
    }

    // For upfront: can claim from ACCEPTED
    // For upon-completion: can only claim from COMPLETED
    if (job.paymentTiming === 'upon_completion' && job.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Cannot claim payment yet',
        reason: 'This is an upon-completion job. The human must mark work as done first.',
      });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PAYMENT_CLAIMED',
        paymentClaimMethod: data.method,
        paymentClaimNote: data.note || null,
        paymentClaimedAt: new Date(),
        lastActionBy: 'AGENT',
      },
    });

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.payment_claimed',
        { method: data.method, note: data.note },
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Payment claim recorded. Waiting for human to confirm receipt.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Claim payment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human confirms they received off-chain payment
// PAYMENT_CLAIMED → PAID (upfront) or PAYMENT_CLAIMED → PAID (upon-completion, terminal)
router.patch('/:id/confirm-payment', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
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

    if (job.status !== 'PAYMENT_CLAIMED') {
      return res.status(400).json({
        error: 'No payment claim to confirm',
        reason: `Job must be in PAYMENT_CLAIMED status. Current: ${job.status}`,
      });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentAmount: job.priceUsdc, // Trust-based: human confirmed the full amount
        lastActionBy: 'HUMAN',
      },
    });

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.paid',
        { method: 'off_chain', claimMethod: job.paymentClaimMethod },
      );
    }

    trackServerEvent(job.humanId, 'payment_confirmed_offchain', {
      jobId: job.id,
      method: job.paymentClaimMethod,
      priceUsdc: job.priceUsdc?.toString(),
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Payment confirmed. ' + (job.completedAt ? 'Job is fully settled.' : 'Work can begin.'),
    });
  } catch (error) {
    logger.error({ err: error }, 'Confirm payment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== CANCEL & DISPUTE =====

// Cancel a job (either party, before money/work exchanged)
router.patch('/:id/cancel', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const body = z.object({ reason: z.string().max(1000).optional() }).parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Authorization: must be the human or the offering agent
    const isHuman = req.senderType === 'human' && req.senderId === job.humanId;
    const isAgent = req.senderType === 'agent' && req.senderId === job.registeredAgentId;
    if (!isHuman && !isAgent) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Allowed-from statuses depend on who is cancelling
    // Human: ACCEPTED, PAYMENT_CLAIMED, PAUSED, SUBMITTED
    // Agent: PENDING (withdraw offer), ACCEPTED, PAYMENT_CLAIMED, PAUSED, SUBMITTED
    const humanAllowed = ['ACCEPTED', 'PAYMENT_CLAIMED', 'PAUSED', 'SUBMITTED'];
    const agentAllowed = ['PENDING', 'ACCEPTED', 'PAYMENT_CLAIMED', 'PAUSED', 'SUBMITTED'];
    const allowed = isHuman ? humanAllowed : agentAllowed;

    if (!allowed.includes(job.status)) {
      // Give helpful error for terminal / post-exchange statuses
      if (['PAID', 'COMPLETED', 'STREAMING'].includes(job.status)) {
        return res.status(400).json({
          error: 'Cannot cancel after money or work has been exchanged',
          hint: 'Use the dispute endpoint instead if something went wrong.',
        });
      }
      return res.status(400).json({
        error: `Cannot cancel job in ${job.status} status`,
      });
    }

    const cancelledBy = isHuman ? 'HUMAN' : 'AGENT';
    const previousStatus = job.status;

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: body.reason || null,
        cancelledBy,
        lastActionBy: cancelledBy,
      },
    });

    // Track job cancellation
    trackServerEvent(req.senderId!, 'job_cancelled', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      cancelled_by: cancelledBy === 'HUMAN' ? 'human' : 'agent',
      time_since_creation_ms: Date.now() - new Date(updated.createdAt).getTime(),
      had_payment: !!(updated as any).paymentTxHash,
      status_before: previousStatus,
    }, req);

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.cancelled',
        { cancelledBy, reason: body.reason },
      );
    }

    const action = job.status === 'PENDING' && isAgent ? 'Offer withdrawn.' : 'Job cancelled.';
    res.json({
      id: updated.id,
      status: updated.status,
      message: action,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Cancel job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dispute a job (either party, after money/work exchanged)
router.patch('/:id/dispute', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const body = z.object({ reason: z.string().min(1).max(1000) }).parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Authorization: must be the human or the offering agent
    const isHuman = req.senderType === 'human' && req.senderId === job.humanId;
    const isAgent = req.senderType === 'agent' && req.senderId === job.registeredAgentId;
    if (!isHuman && !isAgent) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Allowed from: SUBMITTED, PAYMENT_CLAIMED, PAID, COMPLETED, PAUSED (work submitted or money exchanged)
    const allowed = ['SUBMITTED', 'PAYMENT_CLAIMED', 'PAID', 'COMPLETED', 'PAUSED'];
    if (!allowed.includes(job.status)) {
      if (['PENDING', 'ACCEPTED'].includes(job.status)) {
        return res.status(400).json({
          error: 'Cannot dispute before work has been submitted or money exchanged',
          hint: 'Use the cancel endpoint to back out of the deal.',
        });
      }
      return res.status(400).json({
        error: `Cannot dispute job in ${job.status} status`,
      });
    }

    const disputedBy = isHuman ? 'HUMAN' : 'AGENT';

    // Classify dispute type based on whether payment has occurred
    const prePaymentStatuses = ['SUBMITTED', 'PAYMENT_CLAIMED'];
    const disputeType = prePaymentStatuses.includes(job.status) ? 'PRE_PAYMENT' : 'POST_PAYMENT';

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'DISPUTED',
        disputedAt: new Date(),
        disputeReason: body.reason,
        disputeType,
        disputedBy,
        lastActionBy: disputedBy,
      },
    });

    // Track job dispute
    trackServerEvent(req.senderId!, 'job_disputed', {
      jobId: updated.id,
      agentId: updated.registeredAgentId || updated.agentId,
      disputed_by: disputedBy === 'HUMAN' ? 'human' : 'agent',
      time_since_creation_ms: Date.now() - new Date(updated.createdAt).getTime(),
      priceUsdc: updated.priceUsdc?.toString(),
      dispute_type: disputeType,
    }, req);

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.disputed',
        { disputedBy, reason: body.reason, disputeType },
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Job is now disputed.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Dispute job error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent leaves a review (only for COMPLETED jobs)
router.post('/:id/review', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = reviewSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        review: true,
        registeredAgent: {
          select: {
            id: true,
            erc8004AgentId: true,
            wallets: { where: { verified: true }, select: { address: true } },
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the agent assigned to this job can leave a review
    if (!job.registeredAgentId || job.registeredAgentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Only the assigned agent can review this job' });
    }

    // Reviews require at least one of two paths:
    // Path A: Agent proved they paid (verified wallet + senderMatch) — can review without human confirmation
    // Path B: Human marked job completed (traditional flow)
    // This gives verified agents a concrete benefit: they can review (including negative reviews
    // for humans who ghost) without waiting for the human to confirm completion.
    const paymentSettled = job.paidAt || (job.paymentMode === 'STREAM' && job.streamTotalPaid && job.streamTotalPaid.toNumber() > 0);
    const verifiedPayment = job.senderMatch === true && paymentSettled;
    const humanCompleted = !!job.completedAt;

    if (!verifiedPayment && !humanCompleted) {
      return res.status(400).json({
        error: 'Review rejected',
        reason: 'Reviews require either: (1) a verified payment from your registered wallet, or (2) the human marking the job as completed.',
        hint: 'Verify your wallet via set_wallet and pay from it, or wait for the human to mark the job complete.',
      });
    }

    // Check if already reviewed
    if (job.review) {
      return res.status(400).json({ error: 'Job has already been reviewed' });
    }

    // ERC-8004: Pre-compute reputation registry fields at creation time so a
    // future on-chain bridge can publish them without re-deriving anything.
    // See docs/ERC-8004-MAPPING.md for the mapping specification.
    const { value: erc8004Value, valueDecimals: erc8004ValueDecimals } =
      starRatingToERC8004Value(data.rating as 1 | 2 | 3 | 4 | 5);
    const erc8004Tag2 = job.category || '';

    // Build the feedback hash only when the agent has an ERC-8004 ID
    const erc8004AgentId = job.registeredAgent?.erc8004AgentId ?? null;
    let erc8004FeedbackHash: string | null = null;

    // Snapshot wallet verification status at review time
    const walletVerifiedAtReview = (job.registeredAgent?.wallets?.length ?? 0) > 0;

    const review = await prisma.review.create({
      data: {
        jobId: job.id,
        humanId: job.humanId,
        rating: data.rating,
        comment: data.comment,
        walletVerifiedAtReview,
        erc8004Value,
        erc8004ValueDecimals,
        erc8004Tag2,
      },
    });

    // Compute the feedback hash now that we have the review ID
    if (erc8004AgentId != null) {
      const feedback = buildFeedbackJSON({
        agentId: erc8004AgentId,
        rating: data.rating as 1 | 2 | 3 | 4 | 5,
        tag2: erc8004Tag2,
        reviewId: review.id,
        jobId: job.id,
        createdAt: review.createdAt,
        network: job.paymentNetwork ?? undefined,
      });
      erc8004FeedbackHash = hashFeedbackJSON(feedback);
      await prisma.review.update({
        where: { id: review.id },
        data: { erc8004FeedbackHash },
      });
    }

    trackServerEvent(req.agent!.id, 'review_submitted', {
      jobId: job.id,
      humanId: job.humanId,
      rating: data.rating,
      hasComment: !!data.comment,
    }, req);

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

    // Status check: allow on all statuses except terminal ones
    const blockedStatuses = ['CANCELLED', 'REJECTED'];
    if (blockedStatuses.includes(job.status)) {
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

    // Track message sent
    const direction = req.senderType === 'agent' ? 'agent→human' : 'human→agent';
    trackServerEvent(req.senderId!, 'message_sent', {
      jobId: job.id,
      senderType: req.senderType,
      messageLength: data.content.length,
      agentId: job.registeredAgentId || job.agentId,
      direction,
    }, req);

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
          telegramNotifications: true,
          whatsapp: true,
          whatsappVerified: true,
          whatsappNotifications: true,
          whatsappLastInboundAt: true,
          pushNotifications: true,
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

        if (human.telegramChatId && human.telegramNotifications) {
          const preview = data.content.length > 200 ? data.content.slice(0, 200) + '...' : data.content;
          sendTelegramMessage({
            chatId: human.telegramChatId,
            text: `<b>New message from ${req.senderName!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\n\nOn: ${job.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n\n"${preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"\n\n<a href="${jobDetailUrl}">View &amp; Reply</a>`,
            parseMode: 'HTML',
          }).catch((err) => logger.error({ err }, 'Agent message Telegram notification failed'));
        }

        if (isWhatsAppEnabled() && human.whatsapp && human.whatsappVerified && human.whatsappNotifications) {
          const preview = data.content.length > 200 ? data.content.slice(0, 200) + '...' : data.content;
          const waBody = `New message from ${req.senderName!}\n\nOn: ${job.title}\n\n"${preview}"\n\nView: ${jobDetailUrl}`;
          sendWhatsAppNotification({
            to: human.whatsapp,
            humanId: human.id,
            lastInboundAt: human.whatsappLastInboundAt,
            body: waBody,
            jobId: job.id,
            templateType: 'message',
            templateVars: { '1': '1' },
            prisma,
          }).catch((err) => logger.error({ err }, 'Agent message WhatsApp notification failed'));
        }

        // Push notification
        if (human.pushNotifications) {
          sendJobMessagePush(human.id, job.id).catch((err) => logger.error({ err }, 'Agent message push notification failed'));
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

// ===== STREAM PAYMENT ENDPOINTS =====

// Schema for starting a stream
const startStreamSchema = z.object({
  senderAddress: z.string().min(1),
  network: z.string().min(1),
  token: z.string().optional().default('USDC'),
});

// Start a stream payment
router.patch('/:id/start-stream', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = startStreamSchema.parse(req.body);
    const agent = req.agent!;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: {
            wallets: { where: { verified: true }, select: { address: true, network: true } },
          },
        },
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== agent.id) return res.status(403).json({ error: 'Not authorized' });
    if (job.status !== 'ACCEPTED') {
      return res.status(400).json({ error: `Cannot start stream on ${job.status} job. Must be ACCEPTED.` });
    }
    if (job.paymentMode !== 'STREAM') {
      return res.status(400).json({ error: 'This is not a stream job' });
    }

    const networkLower = data.network.toLowerCase();

    if (job.streamMethod === 'SUPERFLUID') {
      // Resolve human's wallet on the network
      const humanWallet = job.human.wallets.find(
        (w) => w.network.toLowerCase() === networkLower
      ) || job.human.wallets[0];

      if (!humanWallet) {
        return res.status(400).json({
          error: 'Human has no wallet for this network',
          hint: `The human needs a wallet on ${data.network} to receive Superfluid streams.`,
        });
      }

      // Get super token address
      const superToken = getSuperTokenAddress(networkLower, data.token);
      if (!superToken) {
        return res.status(400).json({
          error: `No Super Token for ${data.token} on ${data.network}`,
          hint: `Supported networks for Superfluid: ${Object.keys(SUPER_TOKEN_ADDRESSES).join(', ')}`,
        });
      }

      // Calculate expected flow rate
      const expectedFlowRate = usdcPerIntervalToFlowRate(
        job.streamRateUsdc!.toNumber(),
        job.streamInterval!,
      );

      // Verify on-chain flow
      const flowResult = await verifyFlow({
        network: networkLower,
        superToken,
        sender: data.senderAddress,
        receiver: humanWallet.address,
        expectedFlowRate,
      });

      if (!flowResult.active) {
        return res.status(400).json({
          error: 'No active flow found',
          hint: `Create a flow on CFAv1Forwarder (${CFA_V1_FORWARDER}) with: token=${superToken}, receiver=${humanWallet.address}, flowRate=${expectedFlowRate}`,
        });
      }

      if (!flowResult.matchesExpected) {
        return res.status(400).json({
          error: 'Flow rate does not match agreed rate',
          expectedFlowRate,
          actualFlowRate: flowResult.flowRate,
          hint: 'The flow rate must match the agreed stream rate (within 1% tolerance).',
        });
      }

      // Lock stream params and start
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: networkLower,
          streamToken: data.token.toUpperCase(),
          streamSuperToken: superToken,
          streamSenderAddress: data.senderAddress,
          streamFlowRate: flowResult.flowRate,
          streamStartedAt: new Date(),
        },
      });

      // Create first checkpoint tick
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'VERIFIED',
          expectedAt: new Date(),
          graceDeadline: new Date(),
          amount: new Decimal(0),
          verifiedAt: new Date(),
        },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { streamTickCount: 1 },
      });

      // Fire webhook
      if (job.callbackUrl) {
        fireWebhook(
          { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
          'job.stream_started',
          { method: 'SUPERFLUID', network: networkLower, flowRate: flowResult.flowRate },
        );
      }

      trackServerEvent(agent.id, 'stream_started', {
        jobId: updated.id,
        humanId: updated.humanId,
        streamMethod: 'SUPERFLUID',
        streamRateUsdc: job.streamRateUsdc?.toString(),
        streamNetwork: networkLower,
      }, req);

      return res.json({
        id: updated.id,
        status: updated.status,
        message: 'Superfluid flow verified. Stream is now active.',
        stream: {
          method: 'SUPERFLUID',
          network: networkLower,
          superToken,
          flowRate: flowResult.flowRate,
          receiver: humanWallet.address,
        },
      });

    } else {
      // MICRO_TRANSFER: lock network/token, create first PENDING tick
      const intervalMs = {
        HOURLY: 60 * 60 * 1000,
        DAILY: 24 * 60 * 60 * 1000,
        WEEKLY: 7 * 24 * 60 * 60 * 1000,
      };
      const graceMs = {
        HOURLY: 30 * 60 * 1000,
        DAILY: 6 * 60 * 60 * 1000,
        WEEKLY: 24 * 60 * 60 * 1000,
      };

      const interval = job.streamInterval!;
      const expectedAt = new Date();
      const graceDeadline = new Date(expectedAt.getTime() + (graceMs[interval] || intervalMs[interval]));

      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: networkLower,
          streamToken: data.token.toUpperCase(),
          streamStartedAt: new Date(),
        },
      });

      // Create first PENDING tick
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt,
          graceDeadline,
        },
      });

      // Get human's wallet for payment instructions
      const humanWallet = job.human.wallets.find(
        (w) => w.network.toLowerCase() === networkLower
      ) || job.human.wallets[0];

      // Fire webhook
      if (job.callbackUrl) {
        fireWebhook(
          { ...updated, callbackUrl: updated.callbackUrl, callbackSecret: updated.callbackSecret },
          'job.stream_started',
          { method: 'MICRO_TRANSFER', network: networkLower },
        );
      }

      trackServerEvent(agent.id, 'stream_started', {
        jobId: updated.id,
        humanId: updated.humanId,
        streamMethod: 'MICRO_TRANSFER',
        streamRateUsdc: job.streamRateUsdc?.toString(),
        streamNetwork: networkLower,
        streamInterval: interval,
      }, req);

      return res.json({
        id: updated.id,
        status: updated.status,
        message: 'Stream started. Send the first payment.',
        stream: {
          method: 'MICRO_TRANSFER',
          network: networkLower,
          token: data.token.toUpperCase(),
          amount: job.streamRateUsdc?.toString(),
          interval,
          receiverWallet: humanWallet?.address,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Start stream error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record a stream tick payment (micro-transfer only)
const streamTickSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
});

router.patch('/:id/stream-tick', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = streamTickSchema.parse(req.body);
    const agent = req.agent!;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: {
            wallets: { where: { verified: true }, select: { address: true, network: true } },
          },
        },
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== agent.id) return res.status(403).json({ error: 'Not authorized' });
    if (job.status !== 'STREAMING') {
      return res.status(400).json({ error: `Job is not streaming. Current status: ${job.status}` });
    }
    if (job.streamMethod !== 'MICRO_TRANSFER') {
      return res.status(400).json({ error: 'stream-tick is only for micro-transfer streams. Superfluid streams are verified automatically.' });
    }

    // Find the current PENDING tick
    const pendingTick = await prisma.streamTick.findFirst({
      where: { jobId: job.id, status: 'PENDING' },
      orderBy: { tickNumber: 'asc' },
    });

    if (!pendingTick) {
      return res.status(400).json({ error: 'No pending tick to verify' });
    }

    // Get wallet addresses for verification
    const networkLower = job.streamNetwork!;
    const recipientWallets = job.human.wallets
      .filter((w) => w.network.toLowerCase() === networkLower)
      .map((w) => w.address);
    const fallbackWallets = recipientWallets.length > 0
      ? recipientWallets
      : [...new Set(job.human.wallets.map((w) => w.address.toLowerCase()))];

    // Verify on-chain
    const token = (job.streamToken || 'USDC') as SupportedToken;
    const verification = await verifyUsdcPayment({
      txHash: data.txHash,
      network: networkLower,
      recipientWallets: fallbackWallets,
      expectedAmount: job.streamRateUsdc!.toNumber(),
      jobId: job.id,
      token,
    });

    // Verify the sender matches the registered stream sender address
    if (job.streamSenderAddress && verification.from.toLowerCase() !== job.streamSenderAddress.toLowerCase()) {
      return res.status(400).json({
        error: 'Sender mismatch',
        message: 'The transaction sender does not match the registered stream sender address.',
        expectedSender: job.streamSenderAddress,
        actualSender: verification.from,
        hint: 'The payment must come from the same address used to start the stream.',
      });
    }

    // Update tick as VERIFIED
    await prisma.streamTick.update({
      where: { id: pendingTick.id },
      data: {
        status: 'VERIFIED',
        txHash: data.txHash,
        network: networkLower,
        token,
        amount: new Decimal(verification.amount),
        fromAddress: verification.from,
        toAddress: verification.to,
        verifiedAt: new Date(),
        confirmations: verification.confirmations,
      },
    });

    // Update job totals
    const newTotalPaid = (job.streamTotalPaid?.toNumber() || 0) + verification.amount;
    const newTickCount = job.streamTickCount + 1;

    await prisma.job.update({
      where: { id: job.id },
      data: {
        streamTickCount: newTickCount,
        streamTotalPaid: new Decimal(newTotalPaid),
        streamMissedTicks: 0, // Reset consecutive misses
      },
    });

    // Check max ticks
    if (job.streamMaxTicks && newTickCount >= job.streamMaxTicks) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          streamEndedAt: new Date(),
          completedAt: new Date(),
        },
      });

      return res.json({
        id: job.id,
        status: 'COMPLETED',
        message: 'Final tick verified. Stream completed.',
        tick: { tickNumber: pendingTick.tickNumber, amount: verification.amount },
        totalPaid: newTotalPaid,
      });
    }

    // Create next PENDING tick
    const intervalMs: Record<string, number> = {
      HOURLY: 60 * 60 * 1000,
      DAILY: 24 * 60 * 60 * 1000,
      WEEKLY: 7 * 24 * 60 * 60 * 1000,
    };
    const graceMs: Record<string, number> = {
      HOURLY: 30 * 60 * 1000,
      DAILY: 6 * 60 * 60 * 1000,
      WEEKLY: 24 * 60 * 60 * 1000,
    };

    const interval = job.streamInterval!;
    const nextExpectedAt = new Date(Date.now() + intervalMs[interval]);
    const nextGraceDeadline = new Date(nextExpectedAt.getTime() + (graceMs[interval] || intervalMs[interval]));

    await prisma.streamTick.create({
      data: {
        jobId: job.id,
        tickNumber: newTickCount + 1,
        status: 'PENDING',
        expectedAt: nextExpectedAt,
        graceDeadline: nextGraceDeadline,
      },
    });

    res.json({
      id: job.id,
      status: 'STREAMING',
      message: 'Tick verified. Next payment due.',
      tick: { tickNumber: pendingTick.tickNumber, amount: verification.amount },
      totalPaid: newTotalPaid,
      nextTick: {
        tickNumber: newTickCount + 1,
        expectedAt: nextExpectedAt,
        graceDeadline: nextGraceDeadline,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if (error instanceof PaymentVerificationError) {
      return res.status(400).json(error.toResponse());
    }
    logger.error({ err: error }, 'Stream tick error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pause a stream
router.patch('/:id/pause-stream', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: { wallets: { where: { verified: true }, select: { address: true, network: true } } },
        },
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Auth check
    if (req.senderType === 'human' && job.humanId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (req.senderType === 'agent' && job.registeredAgentId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'STREAMING') {
      return res.status(400).json({ error: `Cannot pause job in ${job.status} status` });
    }

    if (job.streamMethod === 'SUPERFLUID') {
      // Verify flow has been deleted
      const humanWallet = job.human.wallets.find(
        (w) => w.network.toLowerCase() === job.streamNetwork!.toLowerCase()
      ) || job.human.wallets[0];

      if (humanWallet && job.streamSuperToken && job.streamSenderAddress) {
        const flowActive = await isFlowActive({
          network: job.streamNetwork!,
          superToken: job.streamSuperToken,
          sender: job.streamSenderAddress,
          receiver: humanWallet.address,
        });

        if (flowActive) {
          return res.status(400).json({
            error: 'Flow is still active',
            hint: 'Delete the Superfluid flow first, then call pause-stream.',
          });
        }
      }

      // Record final checkpoint
      const totalStreamed = job.streamFlowRate && job.streamStartedAt
        ? calculateTotalStreamed(
            job.streamFlowRate,
            Math.floor(job.streamStartedAt.getTime() / 1000),
          )
        : (job.streamTotalPaid?.toNumber() || 0);

      const tickCount = job.streamTickCount + 1;
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: tickCount,
          status: 'VERIFIED',
          expectedAt: new Date(),
          graceDeadline: new Date(),
          amount: new Decimal(totalStreamed),
          verifiedAt: new Date(),
        },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PAUSED',
          streamPausedAt: new Date(),
          streamTickCount: tickCount,
          streamTotalPaid: new Decimal(totalStreamed),
        },
      });
    } else {
      // MICRO_TRANSFER: skip current PENDING tick
      await prisma.streamTick.updateMany({
        where: { jobId: job.id, status: 'PENDING' },
        data: { status: 'SKIPPED' },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PAUSED',
          streamPausedAt: new Date(),
        },
      });
    }

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...job, status: 'PAUSED', callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.stream_paused',
      );
    }

    res.json({
      id: job.id,
      status: 'PAUSED',
      message: 'Stream paused.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Pause stream error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume a stream (agent only)
const resumeStreamSchema = z.object({
  senderAddress: z.string().optional(),
});

router.patch('/:id/resume-stream', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = resumeStreamSchema.parse(req.body);
    const agent = req.agent!;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          include: { wallets: { where: { verified: true }, select: { address: true, network: true } } },
        },
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== agent.id) return res.status(403).json({ error: 'Not authorized' });
    if (job.status !== 'PAUSED') {
      return res.status(400).json({ error: `Cannot resume job in ${job.status} status` });
    }

    if (job.streamMethod === 'SUPERFLUID') {
      const senderAddress = data.senderAddress || job.streamSenderAddress;
      if (!senderAddress) {
        return res.status(400).json({ error: 'senderAddress is required to resume a Superfluid stream' });
      }

      const humanWallet = job.human.wallets.find(
        (w) => w.network.toLowerCase() === job.streamNetwork!.toLowerCase()
      ) || job.human.wallets[0];

      if (!humanWallet) {
        return res.status(400).json({ error: 'No wallet found for human on this network' });
      }

      // Verify new flow exists
      const flowResult = await verifyFlow({
        network: job.streamNetwork!,
        superToken: job.streamSuperToken!,
        sender: senderAddress,
        receiver: humanWallet.address,
      });

      if (!flowResult.active) {
        return res.status(400).json({
          error: 'No active flow found',
          hint: `Create a new flow on ${job.streamNetwork} before resuming.`,
        });
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamSenderAddress: senderAddress,
          streamFlowRate: flowResult.flowRate,
          streamPausedAt: null,
        },
      });
    } else {
      // MICRO_TRANSFER: create new PENDING tick
      const intervalMs: Record<string, number> = {
        HOURLY: 60 * 60 * 1000,
        DAILY: 24 * 60 * 60 * 1000,
        WEEKLY: 7 * 24 * 60 * 60 * 1000,
      };
      const graceMs: Record<string, number> = {
        HOURLY: 30 * 60 * 1000,
        DAILY: 6 * 60 * 60 * 1000,
        WEEKLY: 24 * 60 * 60 * 1000,
      };

      const interval = job.streamInterval!;
      const expectedAt = new Date();
      const graceDeadline = new Date(expectedAt.getTime() + (graceMs[interval] || intervalMs[interval]));

      // Get next tick number
      const lastTick = await prisma.streamTick.findFirst({
        where: { jobId: job.id },
        orderBy: { tickNumber: 'desc' },
      });
      const nextTickNumber = (lastTick?.tickNumber || 0) + 1;

      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: nextTickNumber,
          status: 'PENDING',
          expectedAt,
          graceDeadline,
        },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamPausedAt: null,
          streamMissedTicks: 0,
        },
      });
    }

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...job, status: 'STREAMING', callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.stream_resumed',
      );
    }

    res.json({
      id: job.id,
      status: 'STREAMING',
      message: 'Stream resumed.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Resume stream error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop a stream permanently
router.patch('/:id/stop-stream', authenticateEither, requireActiveIfAgent, async (req: EitherAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Auth check
    if (req.senderType === 'human' && job.humanId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (req.senderType === 'agent' && job.registeredAgentId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'STREAMING' && job.status !== 'PAUSED') {
      return res.status(400).json({ error: `Cannot stop stream in ${job.status} status` });
    }

    // Skip remaining PENDING ticks
    await prisma.streamTick.updateMany({
      where: { jobId: job.id, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        streamEndedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Fire webhook
    if (job.callbackUrl) {
      fireWebhook(
        { ...job, status: 'COMPLETED', callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.stream_stopped',
        { totalPaid: job.streamTotalPaid?.toString() },
      );
    }

    trackServerEvent(req.senderId!, 'stream_stopped', {
      jobId: job.id,
      humanId: job.humanId,
      agentId: job.registeredAgentId || job.agentId,
      stoppedBy: req.senderType,
      totalPaidUsdc: job.streamTotalPaid?.toString(),
      duration_ms: job.streamStartedAt ? Date.now() - new Date(job.streamStartedAt).getTime() : null,
    }, req);

    res.json({
      id: job.id,
      status: 'COMPLETED',
      message: 'Stream stopped. Job completed.',
      totalPaid: job.streamTotalPaid?.toString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Stop stream error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stream ticks (paginated)
router.get('/:id/stream-ticks', authenticateEither, async (req: EitherAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Auth check
    if (req.senderType === 'human' && job.humanId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (req.senderType === 'agent' && job.registeredAgentId !== req.senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [ticks, total] = await Promise.all([
      prisma.streamTick.findMany({
        where: { jobId: job.id },
        orderBy: { tickNumber: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.streamTick.count({ where: { jobId: job.id } }),
    ]);

    res.json({ ticks, total, limit, offset });
  } catch (error) {
    logger.error({ err: error }, 'Get stream ticks error');
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

// POST /api/jobs/:id/review/response — human responds to a review (Google Maps style)
const reviewResponseSchema = z.object({
  responseText: z.string().min(1).max(2000),
});

router.post('/:id/review/response', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const data = reviewResponseSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { review: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Only the reviewed human can respond' });
    }

    if (!job.review) {
      return res.status(400).json({ error: 'No review to respond to' });
    }

    if (job.review.respondedAt) {
      return res.status(400).json({ error: 'You have already responded to this review' });
    }

    const updated = await prisma.review.update({
      where: { id: job.review.id },
      data: {
        responseText: data.responseText,
        respondedAt: new Date(),
      },
    });

    res.json({
      message: 'Response posted successfully',
      review: {
        id: updated.id,
        rating: updated.rating,
        comment: updated.comment,
        responseText: updated.responseText,
        respondedAt: updated.respondedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Review response error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
