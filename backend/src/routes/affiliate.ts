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
  defaultCommission: 2.00,     // $ per qualified signup
  bonusTier1Threshold: 10,     // 10 qualified referrals
  bonusTier1Amount: 25.00,
  bonusTier2Threshold: 50,     // 50 qualified referrals
  bonusTier2Amount: 150.00,
  bonusTier3Threshold: 100,    // 100 qualified referrals
  bonusTier3Amount: 500.00,
  payoutHoldDays: 30,          // 30-day hold before payout
  minPayoutAmount: 25.00,      // Minimum payout threshold
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

// Generate a short code from username or name
function generateDefaultCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) + Math.random().toString(36).slice(2, 6);
}

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
            commissionAmount: true,
            commissionPaid: true,
            createdAt: true,
            referredHuman: {
              select: { id: true, name: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        payouts: {
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
      { threshold: AFFILIATE_CONFIG.bonusTier1Threshold, bonus: affiliate.bonusTier1.toNumber(), label: 'Tier 1' },
      { threshold: AFFILIATE_CONFIG.bonusTier2Threshold, bonus: affiliate.bonusTier2.toNumber(), label: 'Tier 2' },
      { threshold: AFFILIATE_CONFIG.bonusTier3Threshold, bonus: affiliate.bonusTier3.toNumber(), label: 'Tier 3' },
    ];

    const pendingEarnings = affiliate.totalEarnings.toNumber() - affiliate.totalPaid.toNumber();

    res.json({
      enrolled: true,
      affiliate: {
        id: affiliate.id,
        status: affiliate.status,
        code: affiliate.code,
        commissionRate: affiliate.commissionRate.toNumber(),
        totalClicks: affiliate.totalClicks,
        totalSignups: affiliate.totalSignups,
        qualifiedSignups: affiliate.qualifiedSignups,
        totalEarnings: affiliate.totalEarnings.toNumber(),
        totalPaid: affiliate.totalPaid.toNumber(),
        pendingEarnings,
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
        commissionAmount: r.commissionAmount?.toNumber() || 0,
        createdAt: r.createdAt,
      })),
      payouts: affiliate.payouts.map((p) => ({
        id: p.id,
        amount: p.amount.toNumber(),
        status: p.status,
        type: p.type,
        description: p.description,
        eligibleAt: p.eligibleAt,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      config: {
        minPayoutAmount: AFFILIATE_CONFIG.minPayoutAmount,
        payoutHoldDays: AFFILIATE_CONFIG.payoutHoldDays,
      },
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
        commissionRate: AFFILIATE_CONFIG.defaultCommission,
        bonusTier1: AFFILIATE_CONFIG.bonusTier1Amount,
        bonusTier2: AFFILIATE_CONFIG.bonusTier2Amount,
        bonusTier3: AFFILIATE_CONFIG.bonusTier3Amount,
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
        commissionRate: affiliate.commissionRate.toNumber(),
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

// POST /api/affiliate/request-payout — Request a payout
router.post('/request-payout', authenticateToken, requireEmailVerified, affiliateRateLimiter, async (req: AuthRequest, res) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: req.userId! },
    });

    if (!affiliate || affiliate.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Not an active affiliate' });
    }

    const pendingEarnings = affiliate.totalEarnings.toNumber() - affiliate.totalPaid.toNumber();
    if (pendingEarnings < AFFILIATE_CONFIG.minPayoutAmount) {
      return res.status(400).json({
        error: `Minimum payout is $${AFFILIATE_CONFIG.minPayoutAmount}. Current balance: $${pendingEarnings.toFixed(2)}`,
      });
    }

    // Check if there's already a pending/processing payout
    const activePayout = await prisma.affiliatePayout.findFirst({
      where: {
        affiliateId: affiliate.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });
    if (activePayout) {
      return res.status(400).json({ error: 'You already have a pending payout request' });
    }

    // Check the user has a wallet for payout
    const wallet = await prisma.wallet.findFirst({
      where: { humanId: req.userId!, isPrimary: true },
    });
    if (!wallet) {
      return res.status(400).json({ error: 'Please set a primary wallet for payouts' });
    }

    const eligibleAt = new Date(Date.now() + AFFILIATE_CONFIG.payoutHoldDays * 24 * 60 * 60 * 1000);

    const payout = await prisma.affiliatePayout.create({
      data: {
        affiliateId: affiliate.id,
        amount: pendingEarnings,
        type: 'commission',
        description: `Payout of $${pendingEarnings.toFixed(2)} for ${affiliate.qualifiedSignups} qualified referrals`,
        walletAddress: wallet.address,
        network: wallet.network,
        eligibleAt,
      },
    });

    logger.info({ affiliateId: affiliate.id, amount: pendingEarnings, payoutId: payout.id }, 'Payout requested');
    trackServerEvent(req.userId!, 'affiliate_payout_requested', { amount: pendingEarnings }, req);

    res.status(201).json({
      message: 'Payout request submitted',
      payout: {
        id: payout.id,
        amount: payout.amount.toNumber(),
        status: payout.status,
        eligibleAt: payout.eligibleAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Request payout error');
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

    const commissionAmount = referral.affiliate.commissionRate.toNumber();

    // Mark as qualified and assign commission
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: {
        qualified: true,
        qualifiedAt: new Date(),
        commissionAmount,
      },
    });

    // Update affiliate stats
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: referral.affiliate.id },
      data: {
        qualifiedSignups: { increment: 1 },
        totalEarnings: { increment: commissionAmount },
      },
    });

    // Check milestone bonuses
    const qualifiedCount = updatedAffiliate.qualifiedSignups;
    const milestones = [
      { threshold: AFFILIATE_CONFIG.bonusTier1Threshold, type: 'bonus_tier1', amount: updatedAffiliate.bonusTier1.toNumber() },
      { threshold: AFFILIATE_CONFIG.bonusTier2Threshold, type: 'bonus_tier2', amount: updatedAffiliate.bonusTier2.toNumber() },
      { threshold: AFFILIATE_CONFIG.bonusTier3Threshold, type: 'bonus_tier3', amount: updatedAffiliate.bonusTier3.toNumber() },
    ];

    for (const milestone of milestones) {
      // Exact threshold match = just crossed that milestone
      if (qualifiedCount === milestone.threshold) {
        // Check if bonus already awarded
        const existingBonus = await prisma.affiliatePayout.findFirst({
          where: { affiliateId: referral.affiliate.id, type: milestone.type },
        });
        if (!existingBonus) {
          const eligibleAt = new Date(Date.now() + AFFILIATE_CONFIG.payoutHoldDays * 24 * 60 * 60 * 1000);
          await prisma.affiliatePayout.create({
            data: {
              affiliateId: referral.affiliate.id,
              amount: milestone.amount,
              type: milestone.type,
              description: `Milestone bonus: ${milestone.threshold} qualified referrals`,
              eligibleAt,
            },
          });

          await prisma.affiliate.update({
            where: { id: referral.affiliate.id },
            data: { totalEarnings: { increment: milestone.amount } },
          });

          logger.info(
            { affiliateId: referral.affiliate.id, milestone: milestone.type, amount: milestone.amount },
            'Milestone bonus awarded'
          );
        }
      }
    }

    logger.info({ affiliateId: referral.affiliate.id, humanId, commissionAmount }, 'Affiliate referral qualified');
  } catch (error) {
    logger.error({ err: error }, 'Qualify affiliate referral error');
  }
}

export default router;
