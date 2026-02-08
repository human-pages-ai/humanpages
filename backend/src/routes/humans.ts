import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// Helper function to validate URL domain
const isUrlFromDomain = (url: string, domains: string[]) => {
  try {
    const hostname = new URL(url).hostname;
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
};

const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many search requests',
    message: 'Search rate limit: 30 requests per minute. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip || 'unknown';
  },
  validate: false,
});

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
  preferredLanguage: z.enum(['en', 'es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th']).optional(),
  isAvailable: z.boolean().optional(),

  // Economics
  minRateUsdc: z.number().min(0).optional().nullable(),
  rateType: z.enum(['HOURLY', 'FLAT_TASK', 'NEGOTIABLE']).optional(),
  paymentPreference: z.enum(['ESCROW', 'UPFRONT', 'BOTH']).optional(),

  // Offer filters (anti-spam)
  minOfferPrice: z.number().min(0).optional().nullable(),
  maxOfferDistance: z.number().int().min(1).optional().nullable(),

  // Communication
  contactEmail: z.string().email().optional().nullable(),
  telegram: z.string().optional().nullable(),
  whatsapp: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid phone number with country code (e.g. +1234567890)').optional().nullable(),
  signal: z.string().optional().nullable(),

  // Payment methods
  paymentMethods: z.string().optional().nullable(),

  // Notification preferences
  emailNotifications: z.boolean().optional(),

  // Social profiles
  linkedinUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['linkedin.com']),
    'Must be a LinkedIn URL'
  ).optional().nullable(),
  twitterUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['twitter.com', 'x.com']),
    'Must be a Twitter/X URL'
  ).optional().nullable(),
  githubUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['github.com']),
    'Must be a GitHub URL'
  ).optional().nullable(),
  instagramUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['instagram.com']),
    'Must be an Instagram URL'
  ).optional().nullable(),
  youtubeUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['youtube.com', 'youtu.be']),
    'Must be a YouTube URL'
  ).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
});

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

    const { passwordHash, emailVerificationToken, ...profile } = human;
    res.json({ ...profile, reputation, referralCount, hasPassword: !!passwordHash });
  } catch (error) {
    logger.error({ err: error }, 'Get profile error');
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
    logger.error({ err: error }, 'Get referrals error');
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
    const { passwordHash, emailVerificationToken, ...profile } = human;
    res.json({ ...profile, reputation, hasPassword: !!passwordHash });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
router.delete('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({ where: { id: req.userId } });
    if (!human) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has a password, require password confirmation
    if (human.passwordHash) {
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ error: 'Password required to delete account' });
      }
      const validPassword = await bcrypt.compare(password, human.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    // Delete user (cascades to wallets, services, jobs, reviews)
    await prisma.$transaction([
      prisma.passwordReset.deleteMany({ where: { email: human.email } }),
      prisma.human.delete({ where: { id: human.id } }),
    ]);

    logger.info({ userId: human.id }, 'Account deleted');
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Delete account error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export user data
router.get('/me/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      include: {
        wallets: true,
        services: true,
        jobs: { include: { review: true } },
        reviews: true,
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Strip sensitive fields
    const { passwordHash, emailVerificationToken, tokenInvalidatedAt, ...exportData } = human;

    res.json({
      exportedAt: new Date().toISOString(),
      ...exportData,
    });
  } catch (error) {
    logger.error({ err: error }, 'Export data error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search humans (public endpoint for AI agents)
// Supports: skill, equipment, language, location (text), lat/lng + radius, minRate, maxRate
router.get('/search', searchRateLimiter, async (req, res) => {
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
      where.minRateUsdc = { gte: parseFloat(minRate as string) };
    }
    if (maxRate) {
      where.minRateUsdc = {
        ...where.minRateUsdc,
        lte: parseFloat(maxRate as string),
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
        paymentPreference: true,
        contactEmail: true,
        telegram: true,
        whatsapp: true,
        signal: true,
        paymentMethods: true,
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

    // Add reputation stats to each human using batch queries
    const humanIds = humans.map((h) => h.id);

    // Batch query for completed jobs count
    const jobCounts = await prisma.job.groupBy({
      by: ['humanId'],
      where: { humanId: { in: humanIds }, status: 'COMPLETED' },
      _count: true,
    });

    // Batch query for reviews
    const reviewStats = await prisma.review.groupBy({
      by: ['humanId'],
      where: { humanId: { in: humanIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Build lookup maps
    const jobCountMap = new Map(jobCounts.map((jc) => [jc.humanId, jc._count]));
    const reviewStatsMap = new Map(
      reviewStats.map((rs) => [
        rs.humanId,
        {
          avgRating: rs._avg.rating ? Math.round(rs._avg.rating * 10) / 10 : 0,
          reviewCount: rs._count.rating,
        },
      ])
    );

    // Attach stats to each human
    const humansWithReputation = humans.map((h) => ({
      ...h,
      reputation: {
        jobsCompleted: jobCountMap.get(h.id) || 0,
        avgRating: reviewStatsMap.get(h.id)?.avgRating || 0,
        reviewCount: reviewStatsMap.get(h.id)?.reviewCount || 0,
      },
    }));

    // Track search in PostHog
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anonymous';
    trackServerEvent(ip, 'humans_searched', {
      skill,
      location,
      resultCount: humansWithReputation.length,
    });

    res.json(humansWithReputation);
  } catch (error) {
    logger.error({ err: error }, 'Search error');
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
        paymentPreference: true,
        contactEmail: true,
        telegram: true,
        whatsapp: true,
        signal: true,
        paymentMethods: true,
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

    // Track profile view in PostHog
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anonymous';
    trackServerEvent(ip, 'profile_viewed', { humanId: req.params.id });

    const reputation = await getReputationStats(human.id);
    res.json({ ...human, reputation });
  } catch (error) {
    logger.error({ err: error }, 'Get human error');
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
        paymentPreference: true,
        contactEmail: true,
        telegram: true,
        whatsapp: true,
        paymentMethods: true,
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
    logger.error({ err: error }, 'Get human by username error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
