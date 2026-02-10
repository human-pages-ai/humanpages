import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// ===== CONFIG =====
const AFFILIATE_CONFIG = {
  creditsPerReferral: 10,      // Credits per qualified signup
  bonusTier1Threshold: 10,     // 10 qualified referrals
  bonusTier1Credits: 50,
  bonusTier2Threshold: 50,     // 50 qualified referrals
  bonusTier2Credits: 200,
  bonusTier3Threshold: 100,    // 100 qualified referrals
  bonusTier3Credits: 500,
  maxReferralsPerIpPerDay: 5,  // Anti-fraud
};

// Rate limiters
const affiliateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests', message: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// ===== SCHEMAS =====
const applySchema = z.object({
  code: z.string().min(3).max(30).regex(
    /^[a-zA-Z0-9_-]+$/,
    'Code must contain only letters, numbers, hyphens, and underscores'
  ),
  promotionMethod: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  audience: z.string().max(200).optional(),
});

// ===== ROUTES =====

// GET /api/affiliate/me — Get current user's affiliate status & dashboard
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: req.userId! },
      include: {
        referrals: {
          select: {
            id: true,
            qualified: true,
            qualifiedAt: true,
            creditsAwarded: true,
            creditsClaimed: true,
            createdAt: true,
            referredHuman: {
              select: { id: true, name: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        creditLedger: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!affiliate) {
      return res.json({ enrolled: false });
    }

    // Compute milestone progress
    const milestones = [
      { threshold: AFFILIATE_CONFIG.bonusTier1Threshold, bonus: affiliate.bonusTier1, label: 'Tier 1' },
      { threshold: AFFILIATE_CONFIG.bonusTier2Threshold, bonus: affiliate.bonusTier2, label: 'Tier 2' },
      { threshold: AFFILIATE_CONFIG.bonusTier3Threshold, bonus: affiliate.bonusTier3, label: 'Tier 3' },
    ];

    const availableCredits = affiliate.totalCredits - affiliate.creditsRedeemed;

    res.json({
      enrolled: true,
      affiliate: {
        id: affiliate.id,
        status: affiliate.status,
        code: affiliate.code,
        creditsPerReferral: affiliate.creditsPerReferral,
        totalClicks: affiliate.totalClicks,
        totalSignups: affiliate.totalSignups,
        qualifiedSignups: affiliate.qualifiedSignups,
        totalCredits: affiliate.totalCredits,
        creditsRedeemed: affiliate.creditsRedeemed,
        availableCredits,
        approvedAt: affiliate.approvedAt,
        rejectedReason: affiliate.rejectedReason,
        suspendedReason: affiliate.suspendedReason,
        createdAt: affiliate.createdAt,
      },
      milestones: milestones.map((m) => ({
        ...m,
        reached: affiliate.qualifiedSignups >= m.threshold,
        progress: Math.min(affiliate.qualifiedSignups / m.threshold, 1),
      })),
      referrals: affiliate.referrals.map((r) => ({
        id: r.id,
        name: r.referredHuman.name,
        qualified: r.qualified,
        qualifiedAt: r.qualifiedAt,
        creditsAwarded: r.creditsAwarded,
        createdAt: r.createdAt,
      })),
      creditLedger: affiliate.creditLedger.map((c) => ({
        id: c.id,
        credits: c.credits,
        type: c.type,
        description: c.description,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Get affiliate dashboard error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/affiliate/apply — Apply to become an affiliate
router.post('/apply', authenticateToken, requireEmailVerified, affiliateRateLimiter, async (req: AuthRequest, res) => {
  try {
    const { code, promotionMethod, website, audience } = applySchema.parse(req.body);

    // Check if already enrolled
    const existing = await prisma.affiliate.findUnique({
      where: { humanId: req.userId! },
    });
    if (existing) {
      return res.status(400).json({
        error: 'Already enrolled',
        message: existing.status === 'REJECTED'
          ? 'Your previous application was rejected. Contact support to re-apply.'
          : 'You already have an affiliate account.',
      });
    }

    // Check code uniqueness
    const codeExists = await prisma.affiliate.findUnique({ where: { code } });
    if (codeExists) {
      return res.status(400).json({ error: 'Code already taken. Please choose a different code.' });
    }

    // Auto-approve: for now, all applicants are auto-approved
    // In production, you may want manual review for anti-fraud
    const affiliate = await prisma.affiliate.create({
      data: {
        humanId: req.userId!,
        code,
        promotionMethod: promotionMethod || null,
        website: website || null,
        audience: audience || null,
        status: 'APPROVED',
        approvedAt: new Date(),
        creditsPerReferral: AFFILIATE_CONFIG.creditsPerReferral,
        bonusTier1: AFFILIATE_CONFIG.bonusTier1Credits,
        bonusTier2: AFFILIATE_CONFIG.bonusTier2Credits,
        bonusTier3: AFFILIATE_CONFIG.bonusTier3Credits,
      },
    });

    logger.info({ userId: req.userId, affiliateId: affiliate.id, code }, 'Affiliate application approved');
    trackServerEvent(req.userId!, 'affiliate_applied', { code, autoApproved: true }, req);

    res.status(201).json({
      message: 'Welcome to the Partner Program!',
      affiliate: {
        id: affiliate.id,
        status: affiliate.status,
        code: affiliate.code,
        creditsPerReferral: affiliate.creditsPerReferral,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Affiliate application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/affiliate/track-click — Track an affiliate link click (public, no auth)
router.post('/track-click', async (req, res) => {
  try {
    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(req.body);

    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    if (!affiliate || affiliate.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Invalid affiliate code' });
    }

    // Increment click count
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { totalClicks: { increment: 1 } },
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    logger.error({ err: error }, 'Track click error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/affiliate/resolve/:code — Resolve an affiliate code to a referrer ID (public)
router.get('/resolve/:code', async (req, res) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: req.params.code },
      select: { id: true, humanId: true, status: true },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Invalid affiliate code' });
    }

    res.json({ referrerId: affiliate.humanId, affiliateId: affiliate.id });
  } catch (error) {
    logger.error({ err: error }, 'Resolve affiliate code error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/affiliate/leaderboard — Public leaderboard (top affiliates)
router.get('/leaderboard', async (req, res) => {
  try {
    const topAffiliates = await prisma.affiliate.findMany({
      where: { status: 'APPROVED', qualifiedSignups: { gt: 0 } },
      orderBy: { qualifiedSignups: 'desc' },
      take: 20,
      select: {
        code: true,
        qualifiedSignups: true,
        totalCredits: true,
        createdAt: true,
        human: {
          select: { name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json(
      topAffiliates.map((a, i) => ({
        rank: i + 1,
        code: a.code,
        name: a.human.name,
        username: a.human.username,
        avatarUrl: a.human.avatarUrl,
        referrals: a.qualifiedSignups,
        totalCredits: a.totalCredits,
        joinedAt: a.createdAt,
      }))
    );
  } catch (error) {
    logger.error({ err: error }, 'Leaderboard error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== INTERNAL HELPER: Record a referral from an affiliate =====
// Called from auth signup/oauth when a new user signs up with an affiliate code
export async function recordAffiliateReferral(
  affiliateHumanId: string,
  referredHumanId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: affiliateHumanId },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') return;

    // Anti-fraud: check IP-based limits
    if (ipAddress) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ipCount = await prisma.affiliateReferral.count({
        where: {
          affiliateId: affiliate.id,
          ipAddress,
          createdAt: { gte: today },
        },
      });
      if (ipCount >= AFFILIATE_CONFIG.maxReferralsPerIpPerDay) {
        logger.warn({ affiliateId: affiliate.id, ip: ipAddress, count: ipCount }, 'Affiliate IP rate limit hit');
        return;
      }
    }

    // Check if already referred
    const existing = await prisma.affiliateReferral.findUnique({
      where: { referredHumanId },
    });
    if (existing) return;

    // Create referral record
    await prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        referredHumanId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // Update affiliate stats
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { totalSignups: { increment: 1 } },
    });

    logger.info({ affiliateId: affiliate.id, referredHumanId }, 'Affiliate referral recorded');
  } catch (error) {
    // Non-critical: don't fail signup if referral tracking fails
    logger.error({ err: error }, 'Record affiliate referral error');
  }
}

// ===== INTERNAL HELPER: Qualify a referral (called when user completes profile) =====
export async function qualifyAffiliateReferral(humanId: string): Promise<void> {
  try {
    const referral = await prisma.affiliateReferral.findUnique({
      where: { referredHumanId: humanId },
      include: { affiliate: true },
    });

    if (!referral || referral.qualified) return;

    const creditsEarned = referral.affiliate.creditsPerReferral;

    // Mark as qualified and assign credits
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: {
        qualified: true,
        qualifiedAt: new Date(),
        creditsAwarded: creditsEarned,
      },
    });

    // Log the credit entry
    await prisma.affiliateCredit.create({
      data: {
        affiliateId: referral.affiliate.id,
        credits: creditsEarned,
        type: 'referral',
        description: `Referral qualified`,
      },
    });

    // Update affiliate stats
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: referral.affiliate.id },
      data: {
        qualifiedSignups: { increment: 1 },
        totalCredits: { increment: creditsEarned },
      },
    });

    // Check milestone bonuses
    const qualifiedCount = updatedAffiliate.qualifiedSignups;
    const milestones = [
      { threshold: AFFILIATE_CONFIG.bonusTier1Threshold, type: 'bonus_tier1', credits: updatedAffiliate.bonusTier1 },
      { threshold: AFFILIATE_CONFIG.bonusTier2Threshold, type: 'bonus_tier2', credits: updatedAffiliate.bonusTier2 },
      { threshold: AFFILIATE_CONFIG.bonusTier3Threshold, type: 'bonus_tier3', credits: updatedAffiliate.bonusTier3 },
    ];

    for (const milestone of milestones) {
      // Exact threshold match = just crossed that milestone
      if (qualifiedCount === milestone.threshold) {
        // Check if bonus already awarded
        const existingBonus = await prisma.affiliateCredit.findFirst({
          where: { affiliateId: referral.affiliate.id, type: milestone.type },
        });
        if (!existingBonus) {
          await prisma.affiliateCredit.create({
            data: {
              affiliateId: referral.affiliate.id,
              credits: milestone.credits,
              type: milestone.type,
              description: `Milestone bonus: ${milestone.threshold} qualified referrals`,
            },
          });

          await prisma.affiliate.update({
            where: { id: referral.affiliate.id },
            data: { totalCredits: { increment: milestone.credits } },
          });

          logger.info(
            { affiliateId: referral.affiliate.id, milestone: milestone.type, credits: milestone.credits },
            'Milestone bonus awarded'
          );
        }
      }
    }

    logger.info({ affiliateId: referral.affiliate.id, humanId, creditsEarned }, 'Affiliate referral qualified');
  } catch (error) {
    logger.error({ err: error }, 'Qualify affiliate referral error');
  }
}

export default router;
