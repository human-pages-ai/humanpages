import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional(),
  telegram: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      include: { wallets: true, services: true },
    });

    if (!human) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...profile } = human;
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user profile
router.patch('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const updates = updateProfileSchema.parse(req.body);

    const human = await prisma.human.update({
      where: { id: req.userId },
      data: updates,
      include: { wallets: true, services: true },
    });

    const { passwordHash, ...profile } = human;
    res.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search humans (public endpoint for AI agents)
router.get('/search', async (req, res) => {
  try {
    const { skill, location, available } = req.query;

    const where: any = {};

    if (skill) {
      where.skills = { has: skill as string };
    }

    if (location) {
      where.location = { contains: location as string, mode: 'insensitive' };
    }

    if (available === 'true') {
      where.isAvailable = true;
    }

    const humans = await prisma.human.findMany({
      where,
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        skills: true,
        contactEmail: true,
        telegram: true,
        isAvailable: true,
        wallets: {
          select: { network: true, address: true, label: true },
        },
        services: {
          where: { isActive: true },
          select: { title: true, description: true, category: true, priceRange: true },
        },
      },
    });

    res.json(humans);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific human by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        skills: true,
        contactEmail: true,
        telegram: true,
        isAvailable: true,
        wallets: {
          select: { network: true, address: true, label: true },
        },
        services: {
          where: { isActive: true },
          select: { title: true, description: true, category: true, priceRange: true },
        },
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    res.json(human);
  } catch (error) {
    console.error('Get human error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
