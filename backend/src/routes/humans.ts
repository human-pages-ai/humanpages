import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { requireActiveAgent } from '../middleware/requireActiveAgent.js';
import { x402PaymentCheck, X402Request } from '../middleware/x402PaymentCheck.js';
import { requireActiveOrPaid } from '../middleware/requireActiveOrPaid.js';
import { isX402Enabled, X402_PRICES, buildPaymentRequiredResponse } from '../lib/x402.js';
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { convertToUsd, SUPPORTED_CURRENCIES } from '../lib/exchangeRates.js';
import { computeTrustScore } from '../lib/trustScore.js';
import { qualifyAffiliateReferral, getReferralProgramData } from './affiliate.js';
import { getProfilePhotoSignedUrl } from '../lib/storage.js';
import { queueModeration } from '../lib/moderation.js';

const router = Router();

// Tier-based rate limits for profile views (per day)
const TIER_PROFILE_LIMITS: Record<string, number> = {
  BASIC: 1,
  PRO: 50,
};

// Public select fields (no contact info, no wallets)
const publicHumanSelect = {
  id: true,
  name: true,
  username: true,
  bio: true,
  location: true,
  neighborhood: true,
  locationGranularity: true,
  skills: true,
  equipment: true,
  languages: true,
  isAvailable: true,
  minRateUsdc: true,
  rateCurrency: true,
  minRateUsdEstimate: true,
  rateType: true,
  paymentPreferences: true,
  workMode: true,
  linkedinVerified: true,
  githubVerified: true,
  githubUsername: true,
  humanityVerified: true,
  humanityScore: true,
  humanityProvider: true,
  humanityVerifiedAt: true,
  profilePhotoKey: true,
  profilePhotoStatus: true,
  lastActiveAt: true,
  createdAt: true,
  services: {
    where: { isActive: true },
    select: { title: true, description: true, category: true, priceMin: true, priceCurrency: true, priceUnit: true },
  },
} as const;

// Full select fields for active agents (includes contact info + wallets + name)
const fullHumanSelect = {
  ...publicHumanSelect,
  name: true,
  contactEmail: true,
  telegram: true,
  whatsapp: true,
  signal: true,
  paymentMethods: true,
  hideContact: true,
  linkedinUrl: true,
  twitterUrl: true,
  githubUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  youtubeUrl: true,
  websiteUrl: true,
  wallets: {
    select: { network: true, chain: true, address: true, label: true, isPrimary: true },
  },
} as const;

// Helper: generate signed photo URL and strip internal R2 key from response
async function attachPhotoUrl(human: any): Promise<any> {
  if (human.profilePhotoKey && ['approved', 'pending'].includes(human.profilePhotoStatus)) {
    try {
      human.profilePhotoUrl = await getProfilePhotoSignedUrl(human.profilePhotoKey);
    } catch {
      // If signed URL generation fails, just omit the photo
    }
  }
  delete human.profilePhotoKey; // Never expose R2 keys to frontend
  delete human.oauthPhotoUrl; // Never expose raw OAuth photo URLs
  return human;
}

// Helper function to validate URL domain
const isUrlFromDomain = (url: string, domains: string[]) => {
  try {
    const hostname = new URL(url).hostname;
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
};

const verifyHumanityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many verification attempts',
    message: 'Verification rate limit: 5 requests per hour. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

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
  skip: () => process.env.NODE_ENV === 'test',
});

const profileLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Too many profile requests',
    message: 'Profile lookup rate limit: 5 requests per minute. Try again later.',
  },
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const updateProfileSchema = z.object({
  // Identity
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),

  // Location
  location: z.string().optional().nullable(),
  neighborhood: z.string().max(200).optional().nullable(),
  locationGranularity: z.enum(['city', 'neighborhood']).optional(),
  locationLat: z.number().min(-90).max(90).optional().nullable(),
  locationLng: z.number().min(-180).max(180).optional().nullable(),

  // Capabilities
  skills: z.array(z.string().max(100)).max(50).optional(),
  equipment: z.array(z.string().max(100)).max(50).nullable().optional().transform(v => v ?? undefined),
  languages: z.array(z.string().max(100)).max(30).nullable().optional().transform(v => v ?? undefined),
  preferredLanguage: z.enum(['en', 'es', 'zh', 'tl', 'hi', 'vi', 'tr', 'th']).optional(),
  isAvailable: z.boolean().optional(),

  // Economics
  minRateUsdc: z.number().min(0).optional().nullable(),
  rateCurrency: z.string().refine(
    (c) => SUPPORTED_CURRENCIES.includes(c as any),
    `Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
  ).optional(),
  rateType: z.enum(['HOURLY', 'FLAT_TASK', 'NEGOTIABLE']).optional(),
  paymentPreferences: z.array(
    z.enum(['UPFRONT', 'ESCROW', 'UPON_COMPLETION', 'STREAM'])
  ).min(1).optional(),
  workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).nullable().optional(),

  // Offer filters (anti-spam)
  minOfferPrice: z.number().min(0).optional().nullable(),
  maxOfferDistance: z.number().int().min(1).optional().nullable(),

  // Communication
  contactEmail: z.string().email().optional().nullable(),
  telegram: z.string().regex(
    /^@[a-zA-Z](?!.*__)[a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/,
    'Must be a valid Telegram handle (e.g. @username, 5-32 characters after @, starts with a letter, cannot end with underscore)'
  ).optional().nullable(),
  whatsapp: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid phone number with country code (e.g. +1234567890)').optional().nullable(),
  signal: z.string().optional().nullable(),

  // Payment methods
  paymentMethods: z.string().optional().nullable(),

  // Privacy
  hideContact: z.boolean().optional(),

  // Notification preferences
  emailNotifications: z.boolean().optional(),
  telegramNotifications: z.boolean().optional(),
  whatsappNotifications: z.boolean().optional(),

  // Analytics opt-out (GDPR)
  analyticsOptOut: z.boolean().optional(),

  // Email digest mode
  emailDigestMode: z.enum(['REALTIME', 'HOURLY', 'DAILY']).optional(),

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
  facebookUrl: z.string().url().refine(
    (url) => isUrlFromDomain(url, ['facebook.com', 'fb.com']),
    'Must be a Facebook URL'
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

// ERC-8004: This function reads the internal `rating` (1-5 scale), NOT
// `erc8004Value` (0-100 percent scale). Do not substitute erc8004Value here.
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

// Strip contact fields from public responses when user has hideContact enabled
function filterHiddenContact(human: any) {
  if (!human.hideContact) {
    const { hideContact, ...rest } = human;
    return rest;
  }
  const { contactEmail, telegram, whatsapp, signal, paymentMethods, hideContact, ...rest } = human;
  return rest;
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

    const [reputation, trustScore, referralCount, referralProgram] = await Promise.all([
      getReputationStats(human.id),
      computeTrustScore(human.id),
      prisma.human.count({ where: { referredBy: human.id } }),
      getReferralProgramData(human.id),
    ]);

    const { passwordHash, emailVerificationToken, ...profile } = human;
    await attachPhotoUrl(profile);
    res.json({ ...profile, reputation, trustScore, referralCount, referralProgram, hasPassword: !!passwordHash });
  } catch (error) {
    logger.error({ err: error }, 'Get profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Lightweight endpoint: just the referral code (no side-effects, no heavy joins)
router.get('/me/referral-code', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { referralCode: true },
    });
    if (!human) return res.status(404).json({ error: 'User not found' });
    res.json({ referralCode: human.referralCode });
  } catch (error) {
    logger.error({ err: error }, 'Get referral code error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's vouches (given and received)
router.get('/me/vouches', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [given, received] = await Promise.all([
      prisma.vouch.findMany({
        where: { voucherId: req.userId! },
        include: { vouchee: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vouch.findMany({
        where: { voucheeId: req.userId! },
        include: { voucher: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ given, received });
  } catch (error) {
    logger.error({ err: error }, 'Get vouches error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vouch rate limiter
const vouchRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many vouch attempts',
    message: 'Vouch rate limit: 10 requests per hour. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Vouch for another human
router.post('/me/vouch', authenticateToken, requireEmailVerified, vouchRateLimiter, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      username: z.string().min(1),
      comment: z.string().max(200).optional(),
    });
    const { username, comment } = schema.parse(req.body);

    // Find vouchee by username or ID
    const vouchee = await prisma.human.findFirst({
      where: {
        OR: [
          { username },
          { id: username },
        ],
        emailVerified: true,
      },
      select: { id: true, name: true, username: true },
    });

    if (!vouchee) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (vouchee.id === req.userId) {
      return res.status(400).json({ error: 'You cannot vouch for yourself' });
    }

    // Check vouch limit (max 10 given)
    const givenCount = await prisma.vouch.count({
      where: { voucherId: req.userId! },
    });
    if (givenCount >= 10) {
      return res.status(400).json({ error: 'You have reached the maximum of 10 vouches' });
    }

    // Check for existing vouch
    const existing = await prisma.vouch.findUnique({
      where: { voucherId_voucheeId: { voucherId: req.userId!, voucheeId: vouchee.id } },
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already vouched for this person' });
    }

    const vouch = await prisma.vouch.create({
      data: {
        voucherId: req.userId!,
        voucheeId: vouchee.id,
        comment: comment || null,
      },
      include: {
        voucher: { select: { id: true, name: true, username: true } },
        vouchee: { select: { id: true, name: true, username: true } },
      },
    });

    logger.info({ voucherId: req.userId, voucheeId: vouchee.id }, 'Vouch created');
    trackServerEvent(req.userId!, 'vouch_created', { voucheeId: vouchee.id }, req);

    res.status(201).json(vouch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create vouch error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke a vouch
router.delete('/me/vouch/:voucheeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const vouch = await prisma.vouch.findUnique({
      where: {
        voucherId_voucheeId: {
          voucherId: req.userId!,
          voucheeId: req.params.voucheeId,
        },
      },
    });

    if (!vouch) {
      return res.status(404).json({ error: 'Vouch not found' });
    }

    await prisma.vouch.delete({ where: { id: vouch.id } });

    logger.info({ voucherId: req.userId, voucheeId: req.params.voucheeId }, 'Vouch revoked');
    res.json({ message: 'Vouch revoked' });
  } catch (error) {
    logger.error({ err: error }, 'Revoke vouch error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check username availability
router.get('/me/check-username', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const username = req.query.username as string;
    if (!username) {
      return res.json({ available: true });
    }
    const existing = await prisma.human.findFirst({
      where: {
        username,
        NOT: { id: req.userId },
      },
    });
    res.json({ available: !existing });
  } catch (error) {
    logger.error({ err: error }, 'Check username error');
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

    // Compute minRateUsdEstimate if rate or currency changed
    const dataToSave: any = { ...updates, lastActiveAt: new Date() };
    const rateChanged = updates.minRateUsdc !== undefined || updates.rateCurrency !== undefined;
    const urlLockNeeded = updates.linkedinUrl !== undefined || updates.githubUrl !== undefined;
    if (rateChanged || urlLockNeeded) {
      // Need current human to get rate values and verification state
      const current = await prisma.human.findUnique({
        where: { id: req.userId },
        select: { minRateUsdc: true, rateCurrency: true, linkedinVerified: true, githubVerified: true },
      });

      // Prevent changing verified URLs — silently strip the update
      if (current?.linkedinVerified && updates.linkedinUrl !== undefined) {
        delete dataToSave.linkedinUrl;
      }
      if (current?.githubVerified && updates.githubUrl !== undefined) {
        delete dataToSave.githubUrl;
      }
      const rate = updates.minRateUsdc !== undefined ? updates.minRateUsdc : current?.minRateUsdc?.toNumber() ?? null;
      const currency = updates.rateCurrency || current?.rateCurrency || 'USD';
      if (rate != null) {
        dataToSave.minRateUsdEstimate = await convertToUsd(rate, currency);
      } else {
        dataToSave.minRateUsdEstimate = null;
      }
    }

    const human = await prisma.human.update({
      where: { id: req.userId },
      data: dataToSave,
      include: { wallets: true, services: true },
    });

    const [reputation, trustScore] = await Promise.all([
      getReputationStats(human.id),
      computeTrustScore(human.id),
    ]);

    // Check if profile is now "complete" for affiliate qualification
    // Qualification criteria: has bio, has skills, email verified
    if (human.bio && human.skills.length > 0 && human.emailVerified && human.referredBy) {
      qualifyAffiliateReferral(human.id).catch((err) =>
        logger.error({ err }, 'Failed to qualify affiliate referral')
      );
    }

    const { passwordHash, emailVerificationToken, ...profile } = human;
    await attachPhotoUrl(profile);
    res.json({ ...profile, reputation, trustScore, hasPassword: !!passwordHash });
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

// Helper: compute humanity tier from score
function getHumanityTier(score: number | null | undefined): string {
  if (!score || score < 1) return 'none';
  if (score < 20) return 'bronze';
  if (score < 40) return 'silver';
  return 'gold';
}

// Verify humanity via Gitcoin Passport
router.post('/me/verify-humanity', authenticateToken, requireEmailVerified, verifyHumanityLimiter, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      walletAddress: z.string().min(1),
    });
    const { walletAddress } = schema.parse(req.body);

    // Verify user owns this wallet
    const wallet = await prisma.wallet.findFirst({
      where: { humanId: req.userId!, address: walletAddress },
    });
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address not found on your profile' });
    }

    // Call Gitcoin Passport Scorer API
    const apiKey = process.env.GITCOIN_SCORER_API_KEY;
    const scorerId = process.env.GITCOIN_SCORER_ID;
    if (!apiKey || !scorerId) {
      return res.status(503).json({ error: 'Humanity verification service not configured' });
    }

    const gitcoinRes = await fetch(
      `https://api.passport.xyz/v2/stamps/${scorerId}/score/${walletAddress}`,
      {
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!gitcoinRes.ok) {
      const errText = await gitcoinRes.text().catch(() => 'Unknown error');
      logger.error({ status: gitcoinRes.status, body: errText }, 'Gitcoin Passport API error');
      return res.status(502).json({ error: 'Failed to verify with Gitcoin Passport' });
    }

    const gitcoinData = await gitcoinRes.json() as { score?: string; status?: string; error?: string | null };
    if (gitcoinData.error) {
      logger.error({ error: gitcoinData.error }, 'Gitcoin Passport score error');
      return res.status(502).json({ error: 'Gitcoin Passport returned an error' });
    }

    const score = parseFloat(gitcoinData.score || '0');
    const humanityVerified = score >= 20;
    const tier = getHumanityTier(score);

    const updated = await prisma.human.update({
      where: { id: req.userId },
      data: {
        humanityScore: score,
        humanityProvider: 'gitcoin_passport',
        humanityVerifiedAt: new Date(),
        humanityVerified,
      },
    });

    logger.info({ userId: req.userId, score, tier, verified: humanityVerified }, 'Humanity verification completed');

    res.json({
      humanityVerified: updated.humanityVerified,
      humanityScore: updated.humanityScore,
      humanityProvider: updated.humanityProvider,
      humanityTier: tier,
      humanityVerifiedAt: updated.humanityVerifiedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Verify humanity error');
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
      workMode,
      verified,
      paymentType,
      limit = '20',
      offset = '0',
    } = req.query;

    const where: any = {
      emailVerified: true,
      humanStatus: { in: ['ACTIVE', 'FLAGGED'] },
    };

    // Filter by humanity verification
    if (verified === 'humanity') {
      where.humanityVerified = true;
    }

    // Skill search: tokenize for relevance scoring (applied after fetch)
    const skillTokens = skill
      ? (skill as string).toLowerCase().split(/[\s,\-_]+/).filter(t => t.length > 2)
      : [];
    const isSkillSearch = skillTokens.length > 0;

    // Filter by equipment
    if (equipment) {
      where.equipment = { has: equipment as string };
    }

    // Filter by language
    if (language) {
      where.languages = { has: language as string };
    }

    // Filter by location text (search both city and neighborhood)
    if (location) {
      where.OR = [
        { location: { contains: location as string, mode: 'insensitive' } },
        { neighborhood: { contains: location as string, mode: 'insensitive' } },
      ];
    }

    // Filter by availability
    if (available === 'true') {
      where.isAvailable = true;
    }

    // Filter by work mode
    if (workMode) {
      where.workMode = workMode as string;
    }

    // Filter by payment type (has overlap with requested types)
    if (paymentType) {
      where.paymentPreferences = { has: paymentType as string };
    }

    // Filter by rate range (search params are in USD, compare against USD estimate)
    if (minRate) {
      const minRateVal = parseFloat(minRate as string);
      if (!isNaN(minRateVal) && isFinite(minRateVal)) {
        where.minRateUsdEstimate = { gte: minRateVal };
      }
    }
    if (maxRate) {
      const maxRateVal = parseFloat(maxRate as string);
      if (!isNaN(maxRateVal) && isFinite(maxRateVal)) {
        // Include humans with no rate set (negotiable) — they haven't set a floor
        if (where.minRateUsdEstimate) {
          // Both min and max: rate must be in range (nulls excluded since they don't meet minRate)
          where.minRateUsdEstimate = {
            ...where.minRateUsdEstimate,
            lte: maxRateVal,
          };
        } else {
          // Only max: include humans whose rate is <= max OR who have no rate set
          // Use AND to avoid clobbering any existing OR clause (e.g. location filter)
          where.AND = [
            ...(where.AND || []),
            {
              OR: [
                { minRateUsdEstimate: { lte: maxRateVal } },
                { minRateUsdEstimate: null },
              ],
            },
          ];
        }
      }
    }

    const requestedLimit = Math.min(parseInt(limit as string) || 20, 100);
    const requestedOffset = parseInt(offset as string) || 0;

    const MAX_OFFSET = 200;
    if (requestedOffset > MAX_OFFSET) {
      return res.status(400).json({
        error: 'Offset too large',
        message: `Maximum offset is ${MAX_OFFSET}. Use filters to narrow results.`,
      });
    }

    // Fetch humans (public: no contact info, no wallets)
    // When doing skill search, fetch more candidates for relevance scoring
    let humans = await prisma.human.findMany({
      where,
      take: isSkillSearch ? 500 : requestedLimit,
      skip: isSkillSearch ? 0 : requestedOffset,
      orderBy: { lastActiveAt: 'desc' },
      select: {
        ...publicHumanSelect,
        locationLat: true,
        locationLng: true,
      },
    });

    // Score and filter by skill relevance
    if (isSkillSearch) {
      const scored = humans.map(h => {
        let score = 0;
        const skillsLower = (h.skills || []).map(s => s.toLowerCase());
        const bioLower = (h.bio || '').toLowerCase();
        const servicesText = (h.services || [])
          .map(s => `${s.title} ${s.description}`).join(' ').toLowerCase();

        for (const token of skillTokens) {
          // Exact skill match (case-insensitive)
          if (skillsLower.includes(token)) {
            score += 10;
          // Skill contains token as substring (e.g. "social" in "social media")
          } else if (skillsLower.some(s => s.includes(token))) {
            score += 5;
          }
          // Bio or service descriptions contain token
          if (bioLower.includes(token)) score += 2;
          if (servicesText.includes(token)) score += 3;
        }

        return { human: h, score };
      });

      humans = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(requestedOffset, requestedOffset + requestedLimit)
        .map(s => s.human);
    }

    // Apply radius filter if lat/lng provided
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat as string);
      const centerLng = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);

      if (!isNaN(centerLat) && isFinite(centerLat) &&
          !isNaN(centerLng) && isFinite(centerLng) &&
          !isNaN(radiusKm) && isFinite(radiusKm) && radiusKm > 0) {
        humans = humans.filter((h) => {
          if (!h.locationLat || !h.locationLng) return false;
          const dist = calculateDistance(centerLat, centerLng, h.locationLat, h.locationLng);
          return dist <= radiusKm;
        });
      }
    }

    // Inject catch-all concierge profiles when organic results are sparse
    const CATCH_ALL_THRESHOLD = parseInt(process.env.CATCH_ALL_THRESHOLD || '3', 10);
    if (humans.length < CATCH_ALL_THRESHOLD) {
      const catchAllWhere: any = {
        isCatchAll: true,
        emailVerified: true,
        humanStatus: 'ACTIVE',
        id: { notIn: humans.map(h => h.id) },
      };

      // Respect equipment filter
      if (equipment) {
        catchAllWhere.equipment = { has: equipment as string };
      }
      // Respect language filter
      if (language) {
        catchAllWhere.languages = { has: language as string };
      }
      // Respect rate filters
      if (minRate) {
        const minRateVal = parseFloat(minRate as string);
        if (!isNaN(minRateVal) && isFinite(minRateVal)) {
          catchAllWhere.minRateUsdEstimate = { gte: minRateVal };
        }
      }
      if (maxRate) {
        const maxRateVal = parseFloat(maxRate as string);
        if (!isNaN(maxRateVal) && isFinite(maxRateVal)) {
          catchAllWhere.OR = [
            { minRateUsdEstimate: { lte: maxRateVal } },
            { minRateUsdEstimate: null },
          ];
        }
      }
      // No location/radius/workMode filtering — catch-all profiles are remote coordinators

      const catchAlls = await prisma.human.findMany({
        where: catchAllWhere,
        select: {
          ...publicHumanSelect,
          locationLat: true,
          locationLng: true,
        },
      });

      humans = [...humans, ...catchAlls];
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

    // Batch query for vouch counts
    const vouchCounts = await prisma.vouch.groupBy({
      by: ['voucheeId'],
      where: { voucheeId: { in: humanIds } },
      _count: true,
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
    const vouchCountMap = new Map(vouchCounts.map((vc) => [vc.voucheeId, vc._count]));

    // Attach stats to each human and strip coords (contact info already excluded from select)
    const humansWithReputation = await Promise.all(humans.map(async (h) => {
      const { locationLat, locationLng, ...rest } = h;
      await attachPhotoUrl(rest);
      return {
        ...rest,
        vouchCount: vouchCountMap.get(h.id) || 0,
        reputation: {
          jobsCompleted: jobCountMap.get(h.id) || 0,
          avgRating: reviewStatsMap.get(h.id)?.avgRating || 0,
          reviewCount: reviewStatsMap.get(h.id)?.reviewCount || 0,
        },
      };
    }));

    // Track search in PostHog (pass req for country geolocation)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anonymous';
    trackServerEvent(ip, 'humans_searched', {
      skill,
      location,
      resultCount: humansWithReputation.length,
    }, req);

    res.json(humansWithReputation);
  } catch (error) {
    logger.error({ err: error }, 'Search error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get full profile with contact info (active agents only, tier-based rate limit per day)
const profileViewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50, // max tier limit; actual enforcement below
  message: { error: 'Profile view rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AgentAuthRequest) => req.agent?.id || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.get('/:id/profile', profileViewLimiter, x402PaymentCheck('profile_view'), authenticateAgent, requireActiveOrPaid, async (req: X402Request, res) => {
  try {
    const agent = req.agent!;

    // Tier-specific daily rate limit — skipped for x402 paid requests
    if (!req.x402Paid) {
      const tierLimit = TIER_PROFILE_LIMITS[agent.activationTier] || TIER_PROFILE_LIMITS.BASIC;
      const remaining = parseInt(res.getHeader('X-RateLimit-Remaining') as string || '999');
      const used = 50 - remaining;
      if (used > tierLimit) {
        const tierMsg = `Your ${agent.activationTier} tier allows ${tierLimit} profile view(s) per day.`;
        const price = X402_PRICES.profile_view;

        if (isX402Enabled()) {
          const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const paymentRequired = await buildPaymentRequiredResponse('profile_view', resourceUrl);
          res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
          return res.status(402).json({
            ...paymentRequired,
            error: 'Payment required',
            message: `${tierMsg} To proceed, pay $${price} USDC per request via x402, or upgrade to PRO for higher limits.`,
            tier: agent.activationTier,
            limit: tierLimit,
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
          limit: tierLimit,
        });
      }
    }

    const human = await prisma.human.findFirst({
      where: { id: req.params.id, emailVerified: true },
      select: fullHumanSelect,
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    // Log x402 payment if this was a paid request
    if (req.x402Paid && req.x402PaymentPayload) {
      prisma.x402Payment.create({
        data: {
          agentId: agent.id,
          resourceType: 'profile_view',
          resourceId: req.params.id,
          amountUsd: X402_PRICES.profile_view,
          network: req.x402MatchedRequirements?.network || 'eip155:8453',
          paymentPayload: req.x402PaymentPayload as any,
          settled: true,
          agentIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
        },
      }).catch((err) => logger.error({ err }, 'Failed to log x402 payment'));
    }

    const reputation = await getReputationStats(human.id);
    const profileWithPhoto = await attachPhotoUrl({ ...human });
    res.json(filterHiddenContact({ ...profileWithPhoto, reputation }));
  } catch (error) {
    logger.error({ err: error }, 'Get full profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific human by ID (public — no contact info)
router.get('/:id', profileLookupLimiter, async (req, res) => {
  try {
    const human = await prisma.human.findFirst({
      where: { id: req.params.id, emailVerified: true, humanStatus: { in: ['ACTIVE', 'FLAGGED'] } },
      select: {
        ...publicHumanSelect,
        vouchesReceived: {
          select: {
            id: true,
            comment: true,
            createdAt: true,
            voucher: { select: { id: true, name: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    // Track profile view in PostHog (pass req for country geolocation)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anonymous';
    trackServerEvent(ip, 'profile_viewed', { humanId: req.params.id }, req);

    const reputation = await getReputationStats(human.id);
    const { vouchesReceived, ...rest } = human;
    await attachPhotoUrl(rest);
    res.json({ ...rest, reputation, vouches: vouchesReceived });
  } catch (error) {
    logger.error({ err: error }, 'Get human error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get human by username (public — no contact info)
router.get('/u/:username', profileLookupLimiter, async (req, res) => {
  try {
    const human = await prisma.human.findFirst({
      where: { username: req.params.username, emailVerified: true, humanStatus: { in: ['ACTIVE', 'FLAGGED'] } },
      select: {
        ...publicHumanSelect,
        vouchesReceived: {
          select: {
            id: true,
            comment: true,
            createdAt: true,
            voucher: { select: { id: true, name: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!human) {
      return res.status(404).json({ error: 'Human not found' });
    }

    const reputation = await getReputationStats(human.id);
    const { vouchesReceived, ...rest } = human;
    await attachPhotoUrl(rest);
    res.json({ ...rest, reputation, vouches: vouchesReceived });
  } catch (error) {
    logger.error({ err: error }, 'Get human by username error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Disconnect LinkedIn (keeps linkedinUrl, clears linkedinId + linkedinVerified)
router.post('/me/disconnect-linkedin', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        linkedinId: null,
        linkedinVerified: false,
      },
    });

    res.json({ message: 'LinkedIn disconnected' });
  } catch (error) {
    logger.error({ err: error }, 'Disconnect LinkedIn error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Disconnect GitHub (keeps githubUrl, clears githubId + githubVerified + githubUsername)
router.post('/me/disconnect-github', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        githubId: null,
        githubVerified: false,
        githubUsername: null,
      },
    });

    res.json({ message: 'GitHub disconnected' });
  } catch (error) {
    logger.error({ err: error }, 'Disconnect GitHub error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Report a Human User ───

// Rate limit reports: 3 per human per day
const humanReportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reports. Limit: 3 per day.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const humanReportSchema = z.object({
  reason: z.enum(['SPAM', 'FRAUD', 'HARASSMENT', 'IRRELEVANT', 'OTHER']),
  description: z.string().max(1000).optional(),
});

// POST /api/humans/:id/report — report a human user for abuse
router.post('/:id/report', authenticateToken, requireEmailVerified, humanReportLimiter, async (req: AuthRequest, res) => {
  try {
    const data = humanReportSchema.parse(req.body);
    const reportedHumanId = req.params.id;
    const reporterHumanId = req.userId!;

    // Cannot report yourself
    if (reporterHumanId === reportedHumanId) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    // Account age check: must be at least 24 hours old
    const reporter = await prisma.human.findUnique({
      where: { id: reporterHumanId },
      select: { createdAt: true },
    });
    if (!reporter) {
      return res.status(401).json({ error: 'Reporter not found' });
    }
    const accountAgeMs = Date.now() - reporter.createdAt.getTime();
    if (accountAgeMs < 24 * 60 * 60 * 1000) {
      return res.status(403).json({ error: 'Your account must be at least 24 hours old to submit reports' });
    }

    // Lifetime cap: max 10 total reports
    const lifetimeCount = await prisma.humanReport.count({
      where: { reporterHumanId },
    });
    if (lifetimeCount >= 10) {
      return res.status(429).json({ error: 'You have reached the maximum number of lifetime reports (10)' });
    }

    // Duplicate check: no pending report for same target
    const existingPending = await prisma.humanReport.findFirst({
      where: { reporterHumanId, reportedHumanId, status: 'PENDING' },
    });
    if (existingPending) {
      return res.status(400).json({ error: 'You already have a pending report for this user' });
    }

    // Verify target exists
    const target = await prisma.human.findUnique({
      where: { id: reportedHumanId },
      select: { id: true, abuseScore: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create report and increment abuse score atomically
    const [report] = await prisma.$transaction([
      prisma.humanReport.create({
        data: {
          reportedHumanId,
          reporterHumanId,
          reason: data.reason,
          description: data.description,
        },
      }),
      prisma.human.update({
        where: { id: reportedHumanId },
        data: { abuseScore: { increment: 1 } },
      }),
    ]);

    // Check thresholds for auto-suspension/ban
    const nonDismissedCount = await prisma.humanReport.count({
      where: { reportedHumanId, status: { not: 'DISMISSED' } },
    });

    if (nonDismissedCount >= 5) {
      await prisma.human.update({
        where: { id: reportedHumanId },
        data: { humanStatus: 'BANNED', abuseStrikes: { increment: 1 } },
      });
      logger.info({ reportedHumanId, reportCount: nonDismissedCount }, 'Human auto-banned');
    } else if (nonDismissedCount >= 3) {
      await prisma.human.update({
        where: { id: reportedHumanId },
        data: { humanStatus: 'SUSPENDED', abuseStrikes: { increment: 1 } },
      });
      logger.info({ reportedHumanId, reportCount: nonDismissedCount }, 'Human auto-suspended');
    }

    // Queue content moderation for the report
    queueModeration('human_report', report.id).catch((err) =>
      logger.error({ err }, 'Failed to queue report moderation')
    );

    trackServerEvent(reporterHumanId, 'human_reported', {
      reportedHumanId,
      reason: data.reason,
    });

    res.status(201).json({ id: report.id, message: 'Report submitted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Report human error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
