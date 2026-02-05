import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const jobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  priceRange: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Get all jobs for current user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { humanId: req.userId },
    });
    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new job
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = jobSchema.parse(req.body);

    const job = await prisma.job.create({
      data: {
        ...data,
        humanId: req.userId!,
      },
    });

    res.status(201).json(job);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a job
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const updates = jobSchema.partial().parse(req.body);

    const existing = await prisma.job.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: updates,
    });

    res.json(job);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a job
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.job.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await prisma.job.delete({ where: { id: req.params.id } });
    res.json({ message: 'Job deleted' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
