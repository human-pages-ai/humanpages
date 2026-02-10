import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ===== CONFIG =====
const REFERRAL_CONFIG = {
  creditsPerReferral: 10,      // Credits per qualified signup
  bonusTier1Threshold: 10,     // 10 qualified referrals
  bonusTier1Credits: 50,
  bonusTier2Threshold: 50,     // 50 qualified referrals
  bonusTier2Credits: 200,
  bonusTier3Threshold: 100,    // 100 qualified referrals
  bonusTier3Credits: 500,
  maxReferralsPerIpPerDay: 5,  // Anti-fraud
};

// ===== HELPERS =====

// Get or lazily create an Affiliate record for a user
export async function getOrCreateAffiliate(humanId: string) {
  let affiliate = await prisma.affiliate.findUnique({ where: { humanId } });
  if (!affiliate) {
    affiliate = await prisma.affiliate.create({
      data: {
        humanId,
        status: 'APPROVED',
        creditsPerReferral: REFERRAL_CONFIG.creditsPerReferral,
        bonusTier1: REFERRAL_CONFIG.bonusTier1Credits,
        bonusTier2: REFERRAL_CONFIG.bonusTier2Credits,
        bonusTier3: REFERRAL_CONFIG.bonusTier3Credits,
      },
    });
  }
  return affiliate;
}

// Build referral program data for a user (used by profile endpoint)
export async function getReferralProgramData(humanId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { humanId },
    include: {
      referrals: {
        select: {
          id: true,
          qualified: true,
          qualifiedAt: true,
          creditsAwarded: true,
          createdAt: true,
          referredHuman: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      },
      creditLedger: {
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      },
    },
  });

  if (!affiliate) {
    return null;
  }

  const milestones = [
    { threshold: REFERRAL_CONFIG.bonusTier1Threshold, bonus: affiliate.bonusTier1, label: 'Tier 1' },
    { threshold: REFERRAL_CONFIG.bonusTier2Threshold, bonus: affiliate.bonusTier2, label: 'Tier 2' },
    { threshold: REFERRAL_CONFIG.bonusTier3Threshold, bonus: affiliate.bonusTier3, label: 'Tier 3' },
  ];

  return {
    status: affiliate.status,
    creditsPerReferral: affiliate.creditsPerReferral,
    totalSignups: affiliate.totalSignups,
    qualifiedSignups: affiliate.qualifiedSignups,
    totalCredits: affiliate.totalCredits,
    creditsRedeemed: affiliate.creditsRedeemed,
    availableCredits: affiliate.totalCredits - affiliate.creditsRedeemed,
    suspendedReason: affiliate.suspendedReason,
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
  };
}

// ===== ROUTES =====

// GET /api/affiliate/leaderboard — Public leaderboard (top referrers)
router.get('/leaderboard', async (req, res) => {
  try {
    const topReferrers = await prisma.affiliate.findMany({
      where: { status: 'APPROVED', qualifiedSignups: { gt: 0 } },
      orderBy: { qualifiedSignups: 'desc' },
      take: 20,
      select: {
        qualifiedSignups: true,
        totalCredits: true,
        createdAt: true,
        human: {
          select: { name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json(
      topReferrers.map((a, i) => ({
        rank: i + 1,
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

// ===== INTERNAL HELPER: Record a referral =====
// Called from auth signup when a new user signs up with a referrer
export async function recordAffiliateReferral(
  referrerHumanId: string,
  referredHumanId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  try {
    // Auto-create referrer's Affiliate record if it doesn't exist
    const affiliate = await getOrCreateAffiliate(referrerHumanId);

    if (affiliate.status !== 'APPROVED') return;

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
      if (ipCount >= REFERRAL_CONFIG.maxReferralsPerIpPerDay) {
        logger.warn({ affiliateId: affiliate.id, ip: ipAddress, count: ipCount }, 'Referral IP rate limit hit');
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

    // Update stats
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { totalSignups: { increment: 1 } },
    });

    logger.info({ affiliateId: affiliate.id, referredHumanId }, 'Referral recorded');
  } catch (error) {
    logger.error({ err: error }, 'Record referral error');
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

    // Update stats
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
      { threshold: REFERRAL_CONFIG.bonusTier1Threshold, type: 'bonus_tier1', credits: updatedAffiliate.bonusTier1 },
      { threshold: REFERRAL_CONFIG.bonusTier2Threshold, type: 'bonus_tier2', credits: updatedAffiliate.bonusTier2 },
      { threshold: REFERRAL_CONFIG.bonusTier3Threshold, type: 'bonus_tier3', credits: updatedAffiliate.bonusTier3 },
    ];

    for (const milestone of milestones) {
      if (qualifiedCount === milestone.threshold) {
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

    logger.info({ affiliateId: referral.affiliate.id, humanId, creditsEarned }, 'Referral qualified');
  } catch (error) {
    logger.error({ err: error }, 'Qualify referral error');
  }
}

export default router;
