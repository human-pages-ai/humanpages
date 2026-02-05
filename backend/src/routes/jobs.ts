import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

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

// Create a job offer (public endpoint for agents)
router.post('/', async (req, res) => {
  try {
    const data = createJobSchema.parse(req.body);

    // Verify human exists
    const human = await prisma.human.findUnique({
      where: { id: data.humanId },
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

    res.status(201).json({
      id: job.id,
      status: job.status,
      message: 'Job offer created. Waiting for human to accept.',
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
