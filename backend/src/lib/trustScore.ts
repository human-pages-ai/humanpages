/**
 * Trust Score Engine
 *
 * Computes a composite trust score (0–100) from multiple signals.
 * All reads are local DB queries — zero external API calls in the request path.
 *
 * Signals and weights:
 *   Identity verification  (30%) — email, OAuth providers, LinkedIn verified, humanity passport
 *   Behavioral reputation  (40%) — job completion rate, review score, review count, tenure
 *   Social proof           (15%) — vouch count, social profiles linked
 *   Activity               (15%) — recency of activity, profile completeness
 *
 * The score is computed on-the-fly per request (all inputs are cached in the DB).
 * Computation cost: ~3 DB queries batched with Promise.all, <5ms total.
 */

import { prisma } from './prisma.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrustSignals {
  identity: {
    emailVerified: boolean;
    hasGoogle: boolean;
    hasLinkedin: boolean;
    linkedinVerified: boolean;
    humanityVerified: boolean;
    humanityScore: number | null;
    hasGithub: boolean;
  };
  reputation: {
    jobsCompleted: number;
    completionRate: number; // 0-1
    avgRating: number; // 0-5
    reviewCount: number;
    disputeCount: number;
  };
  social: {
    vouchCount: number;
    socialProfilesLinked: number; // 0-6 (linkedin, twitter, github, instagram, youtube, website)
  };
  activity: {
    accountAgeDays: number;
    daysSinceLastActive: number;
    profileCompleteness: number; // 0-1
  };
}

export interface TrustScore {
  score: number;       // 0-100 composite
  level: 'new' | 'basic' | 'verified' | 'trusted';
  signals: TrustSignals;
  breakdown: {
    identity: number;   // 0-30
    reputation: number; // 0-40
    social: number;     // 0-15
    activity: number;   // 0-15
  };
}

// ─── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  identity: 30,
  reputation: 40,
  social: 15,
  activity: 15,
} as const;

// ─── Score Computation ───────────────────────────────────────────────────────

/**
 * Compute identity sub-score (0-1)
 */
function computeIdentityScore(signals: TrustSignals['identity']): number {
  let score = 0;

  // Email verified is baseline (0.15)
  if (signals.emailVerified) score += 0.15;

  // OAuth providers (0.1 each, max 0.2)
  const oauthCount = [signals.hasGoogle, signals.hasLinkedin, signals.hasGithub].filter(Boolean).length;
  score += Math.min(oauthCount * 0.1, 0.2);

  // LinkedIn verified via OAuth (not just URL) (0.2)
  if (signals.linkedinVerified) score += 0.2;

  // GitHub linked (0.1)
  if (signals.hasGithub) score += 0.1;

  // Humanity passport verified (0.25)
  if (signals.humanityVerified) score += 0.25;

  // Humanity score bonus (0.1 for high scores)
  if (signals.humanityScore && signals.humanityScore >= 40) score += 0.1;

  return Math.min(score, 1);
}

/**
 * Compute reputation sub-score (0-1)
 */
function computeReputationScore(signals: TrustSignals['reputation']): number {
  if (signals.jobsCompleted === 0) return 0;

  let score = 0;

  // Completion rate (0-0.3)
  score += signals.completionRate * 0.3;

  // ERC-8004: This reads the internal `rating` (1-5 scale), NOT `erc8004Value`
  // (0-100 percent scale). Do not substitute erc8004Value here.
  // Average rating normalized to 0-0.35 (scale: 1-5 → 0-1)
  const ratingNorm = signals.avgRating > 0 ? (signals.avgRating - 1) / 4 : 0;
  score += ratingNorm * 0.35;

  // Review count (logarithmic, max at ~50 reviews) → 0-0.2
  const reviewNorm = Math.min(Math.log(signals.reviewCount + 1) / Math.log(51), 1);
  score += reviewNorm * 0.2;

  // Dispute penalty (-0.15 per dispute, floor at 0)
  score -= signals.disputeCount * 0.15;

  // Volume bonus: completing 10+ jobs gives extra credit (0-0.15)
  const volumeNorm = Math.min(signals.jobsCompleted / 20, 1);
  score += volumeNorm * 0.15;

  return Math.max(0, Math.min(score, 1));
}

/**
 * Compute social sub-score (0-1)
 */
function computeSocialScore(signals: TrustSignals['social']): number {
  let score = 0;

  // Vouches (logarithmic, max at ~10 vouches) → 0-0.6
  const vouchNorm = Math.min(Math.log(signals.vouchCount + 1) / Math.log(11), 1);
  score += vouchNorm * 0.6;

  // Social profiles linked (0-6, each worth ~0.067) → 0-0.4
  const socialNorm = Math.min(signals.socialProfilesLinked / 4, 1);
  score += socialNorm * 0.4;

  return Math.min(score, 1);
}

/**
 * Compute activity sub-score (0-1)
 */
function computeActivityScore(signals: TrustSignals['activity']): number {
  let score = 0;

  // Account age (max at 365 days) → 0-0.3
  const ageNorm = Math.min(signals.accountAgeDays / 365, 1);
  score += ageNorm * 0.3;

  // Recency (decay: 0 days = 1.0, 30+ days = 0.0) → 0-0.3
  const recencyNorm = Math.max(0, 1 - signals.daysSinceLastActive / 30);
  score += recencyNorm * 0.3;

  // Profile completeness → 0-0.4
  score += signals.profileCompleteness * 0.4;

  return Math.min(score, 1);
}

/**
 * Determine trust level from composite score
 */
function getTrustLevel(score: number): TrustScore['level'] {
  if (score >= 60) return 'trusted';
  if (score >= 35) return 'verified';
  if (score >= 15) return 'basic';
  return 'new';
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

/**
 * Compute profile completeness (0-1) from user fields
 */
function computeProfileCompleteness(human: {
  name: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  contactEmail: string | null;
  telegram: string | null;
  whatsapp: string | null;
}): number {
  const fields = [
    !!human.name,
    !!human.bio,
    !!human.location,
    human.skills.length > 0,
    !!(human.contactEmail || human.telegram || human.whatsapp),
  ];
  return fields.filter(Boolean).length / fields.length;
}

/**
 * Count linked social profiles
 */
function countSocialProfiles(human: {
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  websiteUrl: string | null;
}): number {
  return [
    human.linkedinUrl,
    human.twitterUrl,
    human.githubUrl,
    human.instagramUrl,
    human.youtubeUrl,
    human.websiteUrl,
  ].filter(Boolean).length;
}

/**
 * Compute trust score for a given human ID.
 * Makes 3 batched DB queries — no external API calls.
 */
export async function computeTrustScore(humanId: string): Promise<TrustScore> {
  // Batch all DB reads
  const [human, jobStats, vouchCount] = await Promise.all([
    prisma.human.findUnique({
      where: { id: humanId },
      select: {
        emailVerified: true,
        googleId: true,
        linkedinId: true,
        linkedinVerified: true,
        humanityVerified: true,
        humanityScore: true,
        githubId: true,
        githubVerified: true,
        githubUrl: true,
        linkedinUrl: true,
        twitterUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        websiteUrl: true,
        name: true,
        bio: true,
        location: true,
        skills: true,
        contactEmail: true,
        telegram: true,
        whatsapp: true,
        createdAt: true,
        lastActiveAt: true,
        reviews: { select: { rating: true } },
      },
    }),
    prisma.job.groupBy({
      by: ['status'],
      where: { humanId },
      _count: true,
    }),
    prisma.vouch.count({
      where: { voucheeId: humanId },
    }),
  ]);

  if (!human) {
    throw new Error('User not found');
  }

  // Process job stats
  const statusCounts: Record<string, number> = {};
  for (const stat of jobStats) {
    statusCounts[stat.status] = stat._count;
  }
  const completedJobs = statusCounts['COMPLETED'] || 0;
  const totalJobs = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
  const cancelledJobs = statusCounts['CANCELLED'] || 0;
  const rejectedJobs = statusCounts['REJECTED'] || 0;
  const disputedJobs = statusCounts['DISPUTED'] || 0;
  const relevantJobs = totalJobs - rejectedJobs; // Don't count rejected offers against completion
  const completionRate = relevantJobs > 0 ? completedJobs / relevantJobs : 0;

  // Compute review stats
  const reviews = human.reviews;
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const now = new Date();
  const accountAgeDays = Math.floor((now.getTime() - human.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceLastActive = Math.floor((now.getTime() - human.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));

  // Build signals
  const signals: TrustSignals = {
    identity: {
      emailVerified: human.emailVerified,
      hasGoogle: !!human.googleId,
      hasLinkedin: !!human.linkedinId,
      linkedinVerified: human.linkedinVerified,
      humanityVerified: human.humanityVerified,
      humanityScore: human.humanityScore,
      hasGithub: !!human.githubId || !!human.githubUrl,
    },
    reputation: {
      jobsCompleted: completedJobs,
      completionRate,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      disputeCount: disputedJobs,
    },
    social: {
      vouchCount,
      socialProfilesLinked: countSocialProfiles(human),
    },
    activity: {
      accountAgeDays,
      daysSinceLastActive,
      profileCompleteness: computeProfileCompleteness(human),
    },
  };

  // Compute sub-scores
  const identityRaw = computeIdentityScore(signals.identity);
  const reputationRaw = computeReputationScore(signals.reputation);
  const socialRaw = computeSocialScore(signals.social);
  const activityRaw = computeActivityScore(signals.activity);

  const breakdown = {
    identity: Math.round(identityRaw * WEIGHTS.identity * 10) / 10,
    reputation: Math.round(reputationRaw * WEIGHTS.reputation * 10) / 10,
    social: Math.round(socialRaw * WEIGHTS.social * 10) / 10,
    activity: Math.round(activityRaw * WEIGHTS.activity * 10) / 10,
  };

  const score = Math.round(breakdown.identity + breakdown.reputation + breakdown.social + breakdown.activity);
  const level = getTrustLevel(score);

  return { score, level, signals, breakdown };
}

/**
 * Compute trust scores for multiple humans in a single batch.
 * Optimized for search results — avoids N+1 queries.
 */
export async function computeTrustScoresBatch(humanIds: string[]): Promise<Map<string, TrustScore>> {
  if (humanIds.length === 0) return new Map();

  // Batch all reads across all humans
  const [humans, jobStats, reviews, vouchCounts] = await Promise.all([
    prisma.human.findMany({
      where: { id: { in: humanIds } },
      select: {
        id: true,
        emailVerified: true,
        googleId: true,
        linkedinId: true,
        linkedinVerified: true,
        humanityVerified: true,
        humanityScore: true,
        githubId: true,
        githubVerified: true,
        githubUrl: true,
        linkedinUrl: true,
        twitterUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        websiteUrl: true,
        name: true,
        bio: true,
        location: true,
        skills: true,
        contactEmail: true,
        telegram: true,
        whatsapp: true,
        createdAt: true,
        lastActiveAt: true,
      },
    }),
    prisma.job.groupBy({
      by: ['humanId', 'status'],
      where: { humanId: { in: humanIds } },
      _count: true,
    }),
    prisma.review.groupBy({
      by: ['humanId'],
      where: { humanId: { in: humanIds } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.vouch.groupBy({
      by: ['voucheeId'],
      where: { voucheeId: { in: humanIds } },
      _count: true,
    }),
  ]);

  // Build lookup maps
  const humanMap = new Map(humans.map(h => [h.id, h]));

  const jobStatsMap = new Map<string, Record<string, number>>();
  for (const stat of jobStats) {
    if (!jobStatsMap.has(stat.humanId)) jobStatsMap.set(stat.humanId, {});
    jobStatsMap.get(stat.humanId)![stat.status] = stat._count;
  }

  const reviewMap = new Map(reviews.map(r => [r.humanId, {
    avgRating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
    count: r._count.rating,
  }]));

  const vouchMap = new Map(vouchCounts.map(v => [v.voucheeId, v._count]));

  // Compute scores
  const results = new Map<string, TrustScore>();
  const now = new Date();

  for (const humanId of humanIds) {
    const human = humanMap.get(humanId);
    if (!human) continue;

    const statusCounts = jobStatsMap.get(humanId) || {};
    const completedJobs = statusCounts['COMPLETED'] || 0;
    const totalJobs = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
    const rejectedJobs = statusCounts['REJECTED'] || 0;
    const disputedJobs = statusCounts['DISPUTED'] || 0;
    const relevantJobs = totalJobs - rejectedJobs;
    const completionRate = relevantJobs > 0 ? completedJobs / relevantJobs : 0;

    const reviewData = reviewMap.get(humanId) || { avgRating: 0, count: 0 };
    const accountAgeDays = Math.floor((now.getTime() - human.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastActive = Math.floor((now.getTime() - human.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));

    const signals: TrustSignals = {
      identity: {
        emailVerified: human.emailVerified,
        hasGoogle: !!human.googleId,
        hasLinkedin: !!human.linkedinId,
        linkedinVerified: human.linkedinVerified,
        humanityVerified: human.humanityVerified,
        humanityScore: human.humanityScore,
        hasGithub: !!human.githubId || !!human.githubUrl,
      },
      reputation: {
        jobsCompleted: completedJobs,
        completionRate,
        avgRating: reviewData.avgRating,
        reviewCount: reviewData.count,
        disputeCount: disputedJobs,
      },
      social: {
        vouchCount: vouchMap.get(humanId) || 0,
        socialProfilesLinked: countSocialProfiles(human),
      },
      activity: {
        accountAgeDays,
        daysSinceLastActive,
        profileCompleteness: computeProfileCompleteness(human),
      },
    };

    const identityRaw = computeIdentityScore(signals.identity);
    const reputationRaw = computeReputationScore(signals.reputation);
    const socialRaw = computeSocialScore(signals.social);
    const activityRaw = computeActivityScore(signals.activity);

    const breakdown = {
      identity: Math.round(identityRaw * WEIGHTS.identity * 10) / 10,
      reputation: Math.round(reputationRaw * WEIGHTS.reputation * 10) / 10,
      social: Math.round(socialRaw * WEIGHTS.social * 10) / 10,
      activity: Math.round(activityRaw * WEIGHTS.activity * 10) / 10,
    };

    const score = Math.round(breakdown.identity + breakdown.reputation + breakdown.social + breakdown.activity);
    const level = getTrustLevel(score);

    results.set(humanId, { score, level, signals, breakdown });
  }

  return results;
}

// Export pure computation functions for unit testing
export const _testing = {
  computeIdentityScore,
  computeReputationScore,
  computeSocialScore,
  computeActivityScore,
  getTrustLevel,
  computeProfileCompleteness,
  countSocialProfiles,
};
