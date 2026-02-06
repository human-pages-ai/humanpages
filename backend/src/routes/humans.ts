import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const updateProfileSchema = z.object({
  // Identity
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),

  // Location
  location: z.string().optional().nullable(),
  locationLat: z.number().min(-90).max(90).optional().nullable(),
  locationLng: z.number().min(-180).max(180).optional().nullable(),

  // Capabilities
  skills: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),

  // Economics
  minRateUsdc: z.number().min(0).optional().nullable(),
  rateType: z.enum(['HOURLY', 'FLAT_TASK', 'NEGOTIABLE']).optional(),

  // Offer filters (anti-spam)
  minOfferPrice: z.number().min(0).optional().nullable(),
  maxOfferDistance: z.number().int().min(1).optional().nullable(),

  // Communication
  contactEmail: z.string().email().optional().nullable(),
  telegram: z.string().optional().nullable(),
  signal: z.string().optional().nullable(),

  // Social profiles
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  githubUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  youtubeUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
});

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Get reputation stats for a human
async function getReputationStats(humanId: string) {
  const [completedJobs, reviews] = await Promise.all([
    prisma.job.count({ where: { humanId, status: 'COMPLETED' } }),
    prisma.review.findMany({ where: { humanId }, select: { rating: true } }),
  ]);

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return {
    jobsCompleted: completedJobs,
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount: reviews.length,
  };
}

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

    // Update last active
    await prisma.human.update({
      where: { id: req.userId },
      data: { lastActiveAt: new Date() },
    });

    const reputation = await getReputationStats(human.id);

    // Get referral count
    const referralCount = await prisma.human.count({
      where: { referredBy: human.id },
    });

    const { passwordHash, ...profile } = human;
    res.json({ ...profile, reputation, referralCount });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get referral stats for current user
router.get('/me/referrals', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const referrals = await prisma.human.findMany({
      where: { referredBy: req.userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      count: referrals.length,
      referrals,
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user profile
router.patch('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const updates = updateProfileSchema.parse(req.body);

    // Check username uniqueness if provided
    if (updates.username) {
      const existing = await prisma.human.findFirst({
        where: {
          username: updates.username,
          NOT: { id: req.userId },
        },
      });
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const human = await prisma.human.update({
      where: { id: req.userId },
      data: {
        ...updates,
        lastActiveAt: new Date(),
      },
      include: { wallets: true, services: true },
    });

    const reputation = await getReputationStats(human.id);
    const { passwordHash, ...profile } = human;
    res.json({ ...profile, reputation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search humans (public endpoint for AI agents)
// Supports: skill, equipment, language, location (text), lat/lng + radius, minRate, maxRate
router.get('/search', async (req, res) => {
  try {
    const {
      skill,
      equipment,
      language,
      location,
      lat,
      lng,
      radius, // km
      minRate,
      maxRate,
      available,
      limit = '20',
      offset = '0',
    } = req.query;

    const where: any = {};

    // Filter by skill
    if (skill) {
      where.skills = { has: skill as string };
    }

    // Filter by equipment
    if (equipment) {
      where.equipment = { has: equipment as string };
    }

    // Filter by language
    if (language) {
      where.languages = { has: language as string };
    }

    // Filter by location text
    if (location) {
      where.location = { contains: location as string, mode: 'insensitive' };
    }

    // Filter by availability
    if (available === 'true') {
      where.isAvailable = true;
    }

    // Filter by rate range
    if (minRate) {
      where.minRateUsdc = { lte: parseFloat(minRate as string) };
    }
    if (maxRate) {
      where.minRateUsdc = {
        ...where.minRateUsdc,
        gte: parseFloat(maxRate as string) * 0, // They're willing to work at this rate or less
      };
    }

    // Fetch humans
    let humans = await prisma.human.findMany({
      where,
      take: Math.min(parseInt(limit as string) || 20, 100),
      skip: parseInt(offset as string) || 0,
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        location: true,
        locationLat: true,
        locationLng: true,
        skills: true,
        equipment: true,
        languages: true,
        isAvailable: true,
        minRateUsdc: true,
        rateType: true,
        contactEmail: true,
        telegram: true,
        signal: true,
        linkedinUrl: true,
        twitterUrl: true,
        githubUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        websiteUrl: true,
        lastActiveAt: true,
        createdAt: true,
        wallets: {
          select: { network: true, chain: true, address: true, label: true, isPrimary: true },
        },
        services: {
          where: { isActive: true },
          select: { title: true, description: true, category: true, priceRange: true },
        },
      },
    });

    // Apply radius filter if lat/lng provided
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat as string);
      const centerLng = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);

      humans = humans.filter((h) => {
        if (!h.locationLat || !h.locationLng) return false;
        const dist = calculateDistance(centerLat, centerLng, h.locationLat, h.locationLng);
        return dist <= radiusKm;
      });
    }

    // Add reputation stats to each human
    const humansWithReputation = await Promise.all(
      humans.map(async (h) => ({
        ...h,
        reputation: await getReputationStats(h.id),
      }))
    );

    res.json(humansWithReputation);
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
        username: true,
        bio: true,
        avatarUrl: true,
        location: true,
        locationLat: true,
        locationLng: true,
        skills: true,
        equipment: true,
        languages: true,
        isAvailable: true,
        minRateUsdc: true,
        rateType: true,
        contactEmail: true,
        telegram: true,
        signal: true,
        linkedinUrl: true,
        twitterUrl: true,
        githubUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        websiteUrl: true,
        lastActiveAt: true,
        createdAt: true,
        wallets: {
          select: { network: true, chain: true, address: true, label: true, isPrimary: true },
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

    const reputation = await getReputationStats(human.id);
    res.json({ ...human, reputation });
  } catch (error) {
    console.error('Get human error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get human by username (public)
router.get('/u/:username', async (req, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        location: true,
        skills: true,
        equipment: true,
        languages: true,
        isAvailable: true,
        minRateUsdc: true,
        rateType: true,
        contactEmail: true,
        telegram: true,
        linkedinUrl: true,
        twitterUrl: true,
        githubUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        websiteUrl: true,
        lastActiveAt: true,
        createdAt: true,
        wallets: {
          select: { network: true, chain: true, address: true, label: true, isPrimary: true },
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

    const reputation = await getReputationStats(human.id);
    res.json({ ...human, reputation });
  } catch (error) {
    console.error('Get human by username error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
