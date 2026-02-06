import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sendJobOfferEmail } from '../lib/email.js';

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
});

// Schema for marking job as paid
const markPaidSchema = z.object({
  paymentTxHash: z.string().min(1),
  paymentNetwork: z.string().min(1),
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

    // Verify human exists and get contact info for notification
    const human = await prisma.human.findUnique({
      where: { id: data.humanId },
      select: { id: true, name: true, contactEmail: true, email: true },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
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
      }).catch((err) => console.error('[Email] Notification failed:', err));
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
    console.error('Create job error:', error);
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
    console.error('Get job error:', error);
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
    console.error('Get jobs error:', error);
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
    console.error('Accept job error:', error);
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
    console.error('Reject job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark job as paid (called by agent after sending payment)
router.patch('/:id/paid', async (req, res) => {
  try {
    const data = markPaidSchema.parse(req.body);

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
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

    // Verify payment amount matches agreed price
    const agreedPrice = job.priceUsdc.toNumber();
    if (data.paymentAmount < agreedPrice) {
      return res.status(400).json({
        error: 'Payment rejected',
        reason: `Payment amount ($${data.paymentAmount}) is less than agreed price ($${agreedPrice})`,
        hint: 'Payment must match or exceed the agreed price.',
      });
    }

    // TODO: In production, verify the transaction on-chain
    // For now, we trust the agent's claim

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PAID',
        paymentTxHash: data.paymentTxHash,
        paymentNetwork: data.paymentNetwork,
        paymentAmount: new Decimal(data.paymentAmount),
        paidAt: new Date(),
      },
    });

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Payment recorded. Work can begin.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Mark paid error:', error);
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
    console.error('Complete job error:', error);
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
    console.error('Create review error:', error);
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
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
