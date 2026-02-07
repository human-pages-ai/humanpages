import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sendJobOfferEmail } from '../lib/email.js';
import { sendJobOfferTelegram } from '../lib/telegram.js';
import {
  verifyUsdcPayment,
  PaymentVerificationError,
  SUPPORTED_NETWORKS,
  SUPPORTED_TOKENS,
  type SupportedToken,
} from '../lib/blockchain/index.js';
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';

const router = Router();

// IP-based rate limiting: 20 offers per hour per IP
// Defense in depth against agentId spoofing
const ipRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per IP per hour
  message: {
    error: 'Too many requests from this IP',
    message: 'IP rate limit: 20 offers per hour. Try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  // Disable validation - we handle proxied IPs correctly
  validate: false,
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
});

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

// Rate limit: 5 offers per hour per agent
const RATE_LIMIT_OFFERS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Create a job offer (public endpoint for agents)
// Double rate limiting: IP-based (20/hr) + agentId-based (5/hr)
router.post('/', ipRateLimiter, async (req, res) => {
  try {
    const data = createJobSchema.parse(req.body);

    // Rate limiting: count offers from this agent in the last hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentOfferCount = await prisma.job.count({
      where: {
        agentId: data.agentId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentOfferCount >= RATE_LIMIT_OFFERS) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Agents are limited to ${RATE_LIMIT_OFFERS} offers per hour`,
        retryAfter: '1 hour',
      });
    }

    // Verify human exists and get contact info + filter settings
    const human = await prisma.human.findUnique({
      where: { id: data.humanId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        email: true,
        telegramChatId: true,
        preferredLanguage: true,
        // Filter settings
        minOfferPrice: true,
        maxOfferDistance: true,
        minRateUsdc: true,
        locationLat: true,
        locationLng: true,
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    // Check offer filters
    // 1. Minimum price filter
    if (human.minOfferPrice && data.priceUsdc < human.minOfferPrice.toNumber()) {
      return res.status(400).json({
        error: 'Offer filtered',
        code: 'PRICE_TOO_LOW',
        message: `This human requires a minimum offer of $${human.minOfferPrice} USDC. Your offer of $${data.priceUsdc} was automatically filtered to their spam folder.`,
        minPrice: human.minOfferPrice.toNumber(),
        yourPrice: data.priceUsdc,
      });
    }

    // 2. Minimum rate filter (if human has set it and offer seems too low relative to rate)
    if (human.minRateUsdc && data.priceUsdc < human.minRateUsdc.toNumber()) {
      return res.status(400).json({
        error: 'Offer filtered',
        code: 'BELOW_MIN_RATE',
        message: `This human's minimum rate is $${human.minRateUsdc} USDC. Your offer of $${data.priceUsdc} was automatically filtered to their spam folder.`,
        minRate: human.minRateUsdc.toNumber(),
        yourPrice: data.priceUsdc,
      });
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
        agentName: data.agentName,
        title: data.title,
        description: data.description,
        category: data.category,
        priceUsdc: new Decimal(data.priceUsdc),
        status: 'PENDING',
      },
    });

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    // Send email notification (async, don't block response)
    const notifyEmail = human.contactEmail || human.email;
    if (notifyEmail) {
      sendJobOfferEmail({
        humanName: human.name,
        humanEmail: notifyEmail,
        jobTitle: data.title,
        jobDescription: data.description,
        priceUsdc: data.priceUsdc,
        agentName: data.agentName,
        category: data.category,
        language: human.preferredLanguage,
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
        agentName: data.agentName,
        dashboardUrl,
      }).catch((err) => logger.error({ err }, 'Telegram notification failed'));
    }

    res.status(201).json({
      id: job.id,
      status: job.status,
      message: 'Job offer created. Waiting for human to accept.',
      rateLimit: {
        remaining: RATE_LIMIT_OFFERS - recentOfferCount - 1,
        resetIn: '1 hour',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error({ err: error }, 'Get job error');
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
      },
    });

    res.json(jobs);
  } catch (error) {
    logger.error({ err: error }, 'Get jobs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human accepts a job offer
router.patch('/:id/accept', authenticateToken, async (req: AuthRequest, res) => {
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
      return res.status(400).json({ error: error.errors });
    }
    if (error instanceof PaymentVerificationError) {
      return res.status(400).json(error.toResponse());
    }
    logger.error({ err: error }, 'Mark paid error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Human marks job as completed
router.patch('/:id/complete', authenticateToken, async (req: AuthRequest, res) => {
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
      return res.status(400).json({ error: error.errors });
    }
    logger.error({ err: error }, 'Create review error');
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
