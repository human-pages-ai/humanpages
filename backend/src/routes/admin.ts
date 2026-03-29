import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../lib/bcrypt-rounds.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, requireStaffOrAdmin, apiKeyAdmin, getEffectiveRole } from '../middleware/adminAuth.js';
import { prisma, identityVerifiedWhere } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendStaffApiKeyEmail, sendFeaturedInviteEmail } from '../lib/email.js';
import postingRoutes from './posting.js';
import timeTrackingRoutes from './timeTracking.js';
import contentRoutes from './content.js';
import videoConceptRoutes from './videoConcepts.js';
import photoConceptRoutes from './photoConcepts.js';
import careerAdminRoutes from './careerAdmin.js';
import videoRoutes from './videos.js';
import scheduleRoutes from './schedule.js';
import productivityRoutes from './productivity.js';
import leadRoutes from './leads.js';
import logRoutes from './logs.js';
import mktopsRoutes from './mktops.js';
import videoBatchRoutes from './videoBatches.js';
import watchdogRoutes from './watchdog.js';
import { STAFF_CAPABILITIES, isValidCapability, getEffectiveCapabilities } from '../lib/capabilities.js';
import { getProfilePhotoSignedUrl } from '../lib/storage.js';
import { normalizeCountry, countryFromLocation, continentFromCountry } from '../lib/countries.js';
import { MODEL_PRICING, estimateTokenCost } from '../lib/solverLLM.js';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── API-key routes (read-only, for CLI tooling) ───
// These sit ABOVE the JWT middleware so they don't require a browser session.

// GET /api/admin/ai/stats
router.get('/ai/stats', apiKeyAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [usersTotal, usersVerified, usersLast7d, feedbackTotal, feedbackNew, humanReportsTotal, humanReportsPending, reportsTotal, reportsPending, moderationPending, moderationRejected, moderationErrors] = await Promise.all([
      prisma.human.count(),
      prisma.human.count({ where: identityVerifiedWhere }),
      prisma.human.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'NEW' } }),
      prisma.humanReport.count(),
      prisma.humanReport.count({ where: { status: 'PENDING' } }),
      prisma.agentReport.count(),
      prisma.agentReport.count({ where: { status: 'PENDING' } }),
      prisma.moderationQueue.count({ where: { status: 'pending' } }),
      prisma.moderationQueue.count({ where: { status: 'rejected' } }),
      prisma.moderationQueue.count({ where: { status: 'error' } }),
    ]);

    res.json({
      users: { total: usersTotal, verified: usersVerified, last7d: usersLast7d },
      feedback: { total: feedbackTotal, new: feedbackNew },
      humanReports: { total: humanReportsTotal, pending: humanReportsPending },
      agentReports: { total: reportsTotal, pending: reportsPending },
      moderation: { pending: moderationPending, rejected: moderationRejected, errors: moderationErrors },
    });
  } catch (error) {
    logger.error({ err: error }, 'AI admin stats error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/ai/activity
router.get('/ai/activity', apiKeyAdmin, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [recentUsers, recentFeedback] = await Promise.all([
      prisma.human.findMany({
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.feedback.findMany({
        where: { status: 'NEW' },
        select: { id: true, type: true, category: true, title: true, description: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    res.json({ recentUsers, recentFeedback });
  } catch (error) {
    logger.error({ err: error }, 'AI admin activity error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Content pipeline routes (API key + staff + admin) ───
router.use('/content', contentRoutes);

// ─── Video concepts routes (API key + admin) ───
router.use('/video-concepts', videoConceptRoutes);

// ─── Video batches routes (API key + admin) ───
router.use('/video-batches', videoBatchRoutes);

// ─── Photo concepts routes (API key + admin) ───
router.use('/photo-concepts', photoConceptRoutes);

// ─── Career applications admin routes (API key + admin) ───
router.use('/career-applications', careerAdminRoutes);

// ─── Video management routes (API key + admin) ───
router.use('/videos', videoRoutes);

// ─── Publication schedule routes (API key + admin) ───
router.use('/schedule', scheduleRoutes);

// ─── Lead generation routes (API key + LEAD_GEN capability + admin) ───
router.use('/leads', leadRoutes);

// ─── Log viewer routes (admin only, queries Axiom) ───
router.use('/logs', logRoutes);
router.use('/watchdog', watchdogRoutes);

// ─── Marketing Ops routes (API key + admin) ───
router.use('/mktops', mktopsRoutes);

// ─── Posting queue routes (staff + admin) ───
router.use('/posting', postingRoutes);

// ─── Time tracking routes (staff + admin) ───
router.use('/time-tracking', timeTrackingRoutes);

// GET /api/admin/me — Confirm role (used by frontend to gate UI)
router.get('/me', authenticateToken, requireStaffOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { email: true, role: true, capabilities: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const role = getEffectiveRole(user.email, user.role);
    res.json({
      isAdmin: role === 'ADMIN',
      isStaff: role === 'STAFF',
      role,
      capabilities: getEffectiveCapabilities(role, user.capabilities),
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin /me error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── API-key routes for staff capabilities ───

// GET /api/admin/ai/staff — List all staff with capabilities (API key auth)
router.get('/ai/staff', apiKeyAdmin, async (_req, res) => {
  try {
    const staffUsers = await prisma.human.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] } },
      select: { id: true, name: true, email: true, role: true, capabilities: true },
      orderBy: { createdAt: 'asc' },
    });
    const staff = staffUsers.map((u) => {
      const effectiveRole = getEffectiveRole(u.email, u.role);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: effectiveRole,
        capabilities: getEffectiveCapabilities(effectiveRole, u.capabilities),
      };
    });
    res.json({ staff });
  } catch (error) {
    logger.error({ err: error }, 'AI staff list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/ai/staff/:id/capabilities — Set capabilities (API key auth)
router.patch('/ai/staff/:id/capabilities', apiKeyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { capabilities } = req.body;
    if (!Array.isArray(capabilities)) {
      return res.status(400).json({ error: 'capabilities must be an array' });
    }
    const invalid = capabilities.filter((c: string) => !isValidCapability(c));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Unknown capabilities: ${invalid.join(', ')}. Valid: ${STAFF_CAPABILITIES.join(', ')}` });
    }
    const user = await prisma.human.findUnique({ where: { id }, select: { role: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'User must be STAFF or ADMIN' });
    }
    const updated = await prisma.human.update({
      where: { id },
      data: { capabilities },
      select: { id: true, capabilities: true },
    });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'AI staff capabilities update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Task summary route (staff + admin) ───

// GET /api/admin/tasks/summary — Role-filtered task counts
router.get('/tasks/summary', authenticateToken, requireStaffOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { email: true, role: true, capabilities: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const role = getEffectiveRole(user.email, user.role);
    const capabilities = getEffectiveCapabilities(role, user.capabilities);

    const summary: Record<string, number> = {};
    const counts = await Promise.all([
      capabilities.includes('CONTENT_REVIEWER')
        ? prisma.contentItem.count({ where: { status: { in: ['DRAFT', 'REVIEW'] } } })
        : null,
      capabilities.includes('POSTER')
        ? prisma.postingGroup.count({ where: { status: 'PENDING' } })
        : null,
    ]);

    if (capabilities.includes('CONTENT_REVIEWER')) summary.CONTENT_REVIEWER = counts[0] ?? 0;
    if (capabilities.includes('POSTER')) summary.POSTER = counts[1] ?? 0;
    if (capabilities.includes('CREATIVE')) summary.CREATIVE = 0;

    res.json({ capabilities, summary });
  } catch (error) {
    logger.error({ err: error }, 'Task summary error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Productivity routes (admin-only, SSE stream has its own auth) ───
router.use('/productivity', authenticateToken, requireAdmin, productivityRoutes);

// ─── JWT-protected admin-only routes ───
// All routes below require authentication + admin check
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats — Aggregate dashboard stats
// Performance: ALL queries run in a single Promise.all to avoid sequential awaits.
router.get('/stats', async (_req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Single parallelized batch: all queries run concurrently ──
    const [
      // Core counts
      usersTotal, usersVerified, usersLast7d, usersLast30d,
      agentsTotal, agentsByStatus,
      jobsTotal, jobsByStatus, jobsLast7d, jobsLast30d,
      paymentVolumeOneTime, paymentVolumeStream, paidJobCount,
      reportsTotal, reportsPending,
      affiliatesTotal, affiliatesApproved,
      feedbackTotal, feedbackNew,
      humanReportsTotal, humanReportsPending,
      listingsTotal, listingsOpen, listingsByStatus, applicationsTotal,
      // Insight counts
      cvUploaded, telegramConnected, telegramBotSignups,
      withBio, withPhoto, withService, withEducation, withSkills, withLocation,
      availableCount, googleOAuth, linkedinVerifiedCount, githubVerifiedCount,
      workModeRemote, workModeOnsite, workModeHybrid,
      // UTM
      utmBreakdownRaw,
      // Raw SQL
      educationByTierRaw, topSkillsRaw, completenessDistRaw,
      // Location (for app-level normalization)
      allLocations,
      // Time-to-first-job
      ttfjResult,
      // Wallet metrics
      usersWithWallet, usersWithPrivyDid, walletsTotal, walletsVerified,
      privyWallets, externalWallets, walletsBySource, walletsByNetwork,
      // Usage / activity metrics
      dauCount, wauCount, mauCount,
      signupToActiveRaw,
      dailyAnalyticsRaw,
    ] = await Promise.all([
      // ── Core counts ──
      prisma.human.count(),
      prisma.human.count({ where: identityVerifiedWhere }),
      prisma.human.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.human.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.agent.count(),
      prisma.agent.groupBy({ by: ['status'], _count: true }),
      prisma.job.count(),
      prisma.job.groupBy({ by: ['status'], _count: true }),
      prisma.job.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.job.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.job.aggregate({ _sum: { paymentAmount: true }, where: { paymentAmount: { not: null } } }),
      prisma.job.aggregate({ _sum: { streamTotalPaid: true }, where: { streamTotalPaid: { not: null } } }),
      prisma.job.count({ where: { OR: [{ paidAt: { not: null } }, { streamTotalPaid: { gt: 0 } }] } }),
      prisma.agentReport.count(),
      prisma.agentReport.count({ where: { status: 'PENDING' } }),
      prisma.affiliate.count(),
      prisma.affiliate.count({ where: { status: 'APPROVED' } }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'NEW' } }),
      prisma.humanReport.count(),
      prisma.humanReport.count({ where: { status: 'PENDING' } }),
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'OPEN' } }),
      prisma.listing.groupBy({ by: ['status'], _count: true }),
      prisma.listingApplication.count(),
      // ── Insight counts ──
      prisma.human.count({ where: { cvFileKey: { not: null } } }),
      prisma.human.count({ where: { telegramChatId: { not: null } } }),
      prisma.human.count({ where: { utmSource: 'telegram_bot' } }),
      prisma.human.count({ where: { bio: { not: null } } }),
      prisma.human.count({ where: { profilePhotoStatus: 'approved' } }),
      prisma.human.count({ where: { services: { some: {} } } }),
      prisma.human.count({ where: { educations: { some: {} } } }),
      prisma.human.count({ where: { NOT: { skills: { isEmpty: true } } } }),
      prisma.human.count({ where: { location: { not: null } } }),
      prisma.human.count({ where: { isAvailable: true } }),
      prisma.human.count({ where: { googleId: { not: null } } }),
      prisma.human.count({ where: { linkedinVerified: true } }),
      prisma.human.count({ where: { githubVerified: true } }),
      prisma.human.count({ where: { workMode: 'REMOTE' } }),
      prisma.human.count({ where: { workMode: 'ONSITE' } }),
      prisma.human.count({ where: { workMode: 'HYBRID' } }),
      // ── UTM ──
      prisma.human.groupBy({ by: ['utmSource'], _count: true, where: { utmSource: { not: null } } }),
      // ── Raw SQL ──
      prisma.$queryRaw`
        SELECT tier, COUNT(*)::int AS cnt FROM (
          SELECT DISTINCT ON ("humanId") "humanId",
            CASE
              WHEN degree IN ('PhD','Postdoc','PsyD','EdD','DBA','DMin','DNP','DO','DPharm','MD','JD') THEN 'doctorate'
              WHEN degree IN ('MA','MBA','MCom','MEd','MEng','MFA','MPH','MPhil','MSc','MSW','MTech','LLM') THEN 'masters'
              WHEN degree IN ('BA','BBA','BCA','BEd','BEng','BFA','BMus','BPharm','BSc','BTech') THEN 'bachelors'
              ELSE 'other'
            END AS tier
          FROM "Education"
          ORDER BY "humanId",
            CASE
              WHEN degree IN ('PhD','Postdoc','PsyD','EdD','DBA','DMin','DNP','DO','DPharm','MD','JD') THEN 1
              WHEN degree IN ('MA','MBA','MCom','MEd','MEng','MFA','MPH','MPhil','MSc','MSW','MTech','LLM') THEN 2
              WHEN degree IN ('BA','BBA','BCA','BEd','BEng','BFA','BMus','BPharm','BSc','BTech') THEN 3
              ELSE 4
            END
        ) ranked GROUP BY tier
      ` as Promise<{ tier: string; cnt: number }[]>,
      prisma.$queryRaw`
        SELECT unnest(skills) AS skill, COUNT(*)::int AS cnt
        FROM "Human" WHERE array_length(skills, 1) > 0
        GROUP BY skill ORDER BY cnt DESC LIMIT 10
      ` as Promise<{ skill: string; cnt: number }[]>,
      prisma.$queryRaw`
        SELECT bucket, COUNT(*)::int AS cnt, ROUND(AVG(score))::int AS avg_score FROM (
          SELECT score, CASE
            WHEN score < 20 THEN '0-19' WHEN score < 40 THEN '20-39'
            WHEN score < 60 THEN '40-59' WHEN score < 80 THEN '60-79'
            ELSE '80-100'
          END AS bucket FROM (
            SELECT (
              (CASE WHEN bio IS NOT NULL AND bio != '' THEN 15 ELSE 0 END) +
              (CASE WHEN "profilePhotoStatus" = 'approved' THEN 15 ELSE 0 END) +
              (CASE WHEN array_length(skills, 1) > 0 THEN 15 ELSE 0 END) +
              (CASE WHEN location IS NOT NULL AND location != '' THEN 10 ELSE 0 END) +
              (CASE WHEN EXISTS (SELECT 1 FROM "Service" s WHERE s."humanId" = h.id) THEN 15 ELSE 0 END) +
              (CASE WHEN EXISTS (SELECT 1 FROM "Education" e WHERE e."humanId" = h.id) THEN 10 ELSE 0 END) +
              (CASE WHEN array_length(languages, 1) > 0 THEN 5 ELSE 0 END) +
              (CASE WHEN "emailVerified" = true THEN 10 ELSE 0 END) +
              (CASE WHEN telegram IS NOT NULL OR whatsapp IS NOT NULL THEN 5 ELSE 0 END)
            ) AS score FROM "Human" h
          ) scored
        ) bucketed GROUP BY bucket ORDER BY bucket
      ` as Promise<{ bucket: string; cnt: number; avg_score: number }[]>,
      // ── Location (all rows, normalized in JS) ──
      prisma.human.findMany({ where: { location: { not: null } }, select: { location: true } }),
      // ── Time-to-first-job ──
      prisma.$queryRaw<{ avg_hours: number | null; median_hours: number | null; agent_count: number }[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (first_job - agent_created)) / 3600)::float AS avg_hours,
          (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_job - agent_created)) / 3600))::float AS median_hours,
          COUNT(*)::int AS agent_count
        FROM (
          SELECT a."createdAt" AS agent_created, MIN(j."createdAt") AS first_job
          FROM "Agent" a JOIN "Job" j ON j."agentId" = a.id
          GROUP BY a.id, a."createdAt"
        ) sub
      `,
      // ── Wallet metrics ──
      prisma.human.count({ where: { wallets: { some: {} } } }),
      prisma.human.count({ where: { privyDid: { not: null } } }),
      prisma.wallet.count(),
      prisma.wallet.count({ where: { verified: true } }),
      prisma.wallet.count({ where: { source: 'privy' } }),
      prisma.wallet.count({ where: { source: 'external' } }),
      prisma.wallet.groupBy({ by: ['source'], _count: true }),
      prisma.wallet.groupBy({ by: ['network'], _count: true }),
      // ── Usage / activity metrics ──
      // DAU: users active in last 24h
      prisma.human.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
      // WAU: users active in last 7d
      prisma.human.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
      // MAU: users active in last 30d
      prisma.human.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
      // Signup-to-active conversion: users who signed up 7+ days ago AND were active in last 7d
      prisma.human.count({
        where: { createdAt: { lt: sevenDaysAgo }, lastActiveAt: { gte: sevenDaysAgo } },
      }),
      // ── Combined daily analytics (single query, 90 days) ──
      // Returns all signup breakdown + activity + marketplace + revenue in one scan
      prisma.$queryRaw`
        WITH days AS (
          SELECT d::date AS day
          FROM generate_series(
            (NOW() - INTERVAL '89 days')::date, NOW()::date, '1 day'::interval
          ) d
        ),
        signup_base AS (
          SELECT
            h."createdAt"::date AS day,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE h."emailVerified" = true)::int AS verified,
            COUNT(*) FILTER (WHERE h."cvFileKey" IS NOT NULL)::int AS with_cv,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id))::int AS with_crypto
          FROM "Human" h
          WHERE h."createdAt" >= (NOW() - INTERVAL '89 days')::date
          GROUP BY h."createdAt"::date
        ),
        active_base AS (
          SELECT h."lastActiveAt"::date AS day, COUNT(*)::int AS active
          FROM "Human" h
          WHERE h."lastActiveAt" >= (NOW() - INTERVAL '89 days')::date
          GROUP BY h."lastActiveAt"::date
        ),
        jobs_base AS (
          SELECT
            j."createdAt"::date AS day,
            COUNT(*)::int AS jobs,
            COUNT(*) FILTER (WHERE j."paidAt" IS NOT NULL OR j."streamTotalPaid" > 0)::int AS paid_jobs,
            COALESCE(SUM(
              COALESCE(j."paymentAmount", 0) + COALESCE(j."streamTotalPaid", 0)
            ), 0)::float AS payment_volume
          FROM "Job" j
          WHERE j."createdAt" >= (NOW() - INTERVAL '89 days')::date
          GROUP BY j."createdAt"::date
        ),
        apps_base AS (
          SELECT la."createdAt"::date AS day, COUNT(*)::int AS apps
          FROM "ListingApplication" la
          WHERE la."createdAt" >= (NOW() - INTERVAL '89 days')::date
          GROUP BY la."createdAt"::date
        ),
        agents_base AS (
          SELECT a."createdAt"::date AS day, COUNT(*)::int AS agents
          FROM "Agent" a
          WHERE a."createdAt" >= (NOW() - INTERVAL '89 days')::date
          GROUP BY a."createdAt"::date
        ),
        pre_count AS (
          SELECT COUNT(*)::int AS cnt FROM "Human"
          WHERE "createdAt"::date < (NOW() - INTERVAL '89 days')::date
        )
        SELECT
          d.day,
          COALESCE(s.total, 0)::int              AS total,
          COALESCE(s.verified, 0)::int            AS verified,
          COALESCE(s.with_cv, 0)::int             AS with_cv,
          COALESCE(s.with_crypto, 0)::int         AS with_crypto,
          COALESCE(ab.active, 0)::int             AS active,
          COALESCE(jb.jobs, 0)::int               AS jobs,
          COALESCE(jb.paid_jobs, 0)::int          AS paid_jobs,
          COALESCE(jb.payment_volume, 0)::float   AS payment_volume,
          COALESCE(ap.apps, 0)::int               AS apps,
          COALESCE(ag.agents, 0)::int             AS agents,
          (pc.cnt + SUM(COALESCE(s.total, 0)) OVER (ORDER BY d.day))::int AS cumulative
        FROM days d
        CROSS JOIN pre_count pc
        LEFT JOIN signup_base s  ON s.day = d.day
        LEFT JOIN active_base ab ON ab.day = d.day
        LEFT JOIN jobs_base jb   ON jb.day = d.day
        LEFT JOIN apps_base ap   ON ap.day = d.day
        LEFT JOIN agents_base ag ON ag.day = d.day
        ORDER BY d.day
      ` as Promise<{
        day: Date; total: number; verified: number; with_cv: number;
        with_crypto: number; active: number; jobs: number; paid_jobs: number;
        payment_volume: number; apps: number; agents: number; cumulative: number;
      }[]>,
    ]);

    // ── Post-processing (pure JS, no DB calls) ──

    // Location aggregation by country (normalized)
    const countryBuckets: Record<string, number> = {};
    const continentBuckets: Record<string, number> = {};
    for (const { location } of allLocations) {
      if (!location || location.toLowerCase() === 'remote') continue;
      const country = countryFromLocation(location);
      countryBuckets[country] = (countryBuckets[country] || 0) + 1;
      const continent = continentFromCountry(country);
      continentBuckets[continent] = (continentBuckets[continent] || 0) + 1;
    }
    const topCountriesSorted = Object.entries(countryBuckets)
      .sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([country, count]) => ({ country, count }));
    const continentSorted = Object.entries(continentBuckets)
      .sort((a, b) => b[1] - a[1])
      .map(([continent, count]) => ({ continent, count }));

    // Profile completeness
    const totalCompUsers = (completenessDistRaw as { bucket: string; cnt: number; avg_score: number }[]).reduce((s, r) => s + r.cnt, 0);
    const weightedAvg = totalCompUsers > 0
      ? Math.round((completenessDistRaw as { bucket: string; cnt: number; avg_score: number }[]).reduce((s, r) => s + r.avg_score * r.cnt, 0) / totalCompUsers)
      : 0;

    // Education tier map
    const eduMap: Record<string, number> = {};
    for (const r of (educationByTierRaw as { tier: string; cnt: number }[])) eduMap[r.tier] = r.cnt;

    // Status maps
    const agentStatusMap: Record<string, number> = {};
    for (const g of agentsByStatus) agentStatusMap[g.status] = g._count;
    const jobStatusMap: Record<string, number> = {};
    for (const g of jobsByStatus) jobStatusMap[g.status] = g._count;

    // Retention: % of users who signed up 7+ days ago that came back this week
    const olderUsers = usersTotal - usersLast7d;
    const retentionRate = olderUsers > 0 ? Math.round((signupToActiveRaw / olderUsers) * 10000) / 100 : 0;

    // Daily analytics — extract each series from the combined query result
    type DailyRow = typeof dailyAnalyticsRaw[number];
    const mapDay = (rows: DailyRow[], key: keyof Omit<DailyRow, 'day'>) =>
      rows.map(r => ({ day: new Date(r.day).toISOString().slice(0, 10), count: Number(r[key]) }));
    const signupsByDay = mapDay(dailyAnalyticsRaw, 'total');
    const activeByDay = mapDay(dailyAnalyticsRaw, 'active');
    const cryptoSignupsByDay = mapDay(dailyAnalyticsRaw, 'with_crypto');
    const cvSignupsByDay = mapDay(dailyAnalyticsRaw, 'with_cv');
    const verifiedSignupsByDay = mapDay(dailyAnalyticsRaw, 'verified');
    const cumulativeSignups = mapDay(dailyAnalyticsRaw, 'cumulative');
    const jobsByDay = mapDay(dailyAnalyticsRaw, 'jobs');
    const paidJobsByDay = mapDay(dailyAnalyticsRaw, 'paid_jobs');
    const paymentVolumeByDay = dailyAnalyticsRaw.map(r => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      count: Math.round(Number(r.payment_volume) * 100) / 100,
    }));
    const applicationsByDay = mapDay(dailyAnalyticsRaw, 'apps');
    const agentsByDay = mapDay(dailyAnalyticsRaw, 'agents');

    res.json({
      users: { total: usersTotal, verified: usersVerified, last7d: usersLast7d, last30d: usersLast30d },
      agents: { total: agentsTotal, byStatus: agentStatusMap },
      jobs: {
        total: jobsTotal, byStatus: jobStatusMap,
        last7d: jobsLast7d, last30d: jobsLast30d,
        paymentVolume: (paymentVolumeOneTime._sum.paymentAmount?.toNumber() ?? 0) + (paymentVolumeStream._sum.streamTotalPaid?.toNumber() ?? 0),
        paidJobCount,
      },
      reports: { total: reportsTotal, pending: reportsPending },
      affiliates: { total: affiliatesTotal, approved: affiliatesApproved },
      feedback: { total: feedbackTotal, new: feedbackNew },
      humanReports: { total: humanReportsTotal, pending: humanReportsPending },
      listings: {
        total: listingsTotal, open: listingsOpen,
        byStatus: Object.fromEntries(listingsByStatus.map(g => [g.status, g._count])),
        applications: applicationsTotal,
      },
      timeToFirstJob: {
        avgHours: ttfjResult[0]?.avg_hours ?? null,
        medianHours: ttfjResult[0]?.median_hours ?? null,
        agentsWithJobs: ttfjResult[0]?.agent_count ?? 0,
      },
      usage: {
        dau: dauCount,
        wau: wauCount,
        mau: mauCount,
        dauWauRatio: wauCount > 0 ? Math.round((dauCount / wauCount) * 10000) / 100 : 0,
        retentionRate,
        returningUsers: signupToActiveRaw,
        signupsByDay,
        activeByDay,
        cryptoSignupsByDay,
        cvSignupsByDay,
        verifiedSignupsByDay,
        cumulativeSignups,
        jobsByDay,
        paidJobsByDay,
        paymentVolumeByDay,
        applicationsByDay,
        agentsByDay,
      },
      insights: {
        cvUploaded, telegramConnected, telegramBotSignups,
        education: {
          bachelors: eduMap['bachelors'] ?? 0, masters: eduMap['masters'] ?? 0,
          doctorate: eduMap['doctorate'] ?? 0, other: eduMap['other'] ?? 0,
        },
        profileCompleteness: {
          avgScore: weightedAvg,
          withBio, withPhoto, withService, withEducation, withSkills, withLocation,
          available: availableCount,
          distribution: Object.fromEntries(
            ['0-19', '20-39', '40-59', '60-79', '80-100'].map(b => [
              b, (completenessDistRaw as { bucket: string; cnt: number }[]).find(r => r.bucket === b)?.cnt ?? 0,
            ])
          ),
        },
        verification: { google: googleOAuth, linkedin: linkedinVerifiedCount, github: githubVerifiedCount },
        workMode: { REMOTE: workModeRemote, ONSITE: workModeOnsite, HYBRID: workModeHybrid },
        utmSources: Object.fromEntries(
          utmBreakdownRaw.filter(r => r.utmSource != null)
            .sort((a, b) => b._count - a._count).slice(0, 15)
            .map(r => [r.utmSource, r._count])
        ),
        topSkills: (topSkillsRaw as { skill: string; cnt: number }[]).map(r => ({ skill: r.skill, count: r.cnt })),
        topCountries: topCountriesSorted,
        continentBreakdown: continentSorted,
        crypto: {
          usersWithWallet, usersWithPrivyDid, walletsTotal, walletsVerified,
          privyWallets, externalWallets,
          walletsBySource: Object.fromEntries(walletsBySource.map(r => [r.source, r._count])),
          walletsByNetwork: Object.fromEntries(walletsByNetwork.map(r => [r.network, r._count])),
          adoptionRate: usersTotal > 0 ? Math.round((usersWithWallet / usersTotal) * 10000) / 100 : 0,
          privyRate: usersTotal > 0 ? Math.round((usersWithPrivyDid / usersTotal) * 10000) / 100 : 0,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin stats error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/stats/funnel — Signup funnel, attribution & behavior analytics
router.get('/stats/funnel', async (_req, res) => {
  try {
    const [
      // ── Funnel stage breakdown (all-time snapshot) ──
      funnelStagesRaw,
      // ── Signup source quality (by UTM source, last 90 days) ──
      sourceQualityRaw,
      // ── Signup method breakdown by day (last 90 days) ──
      signupMethodsByDayRaw,
      // ── Abandonment cohort analysis: signed up N+ days ago, still stuck at each stage ──
      abandonmentRaw,
      // ── Onboarding velocity: median time from signup to each milestone ──
      velocityRaw,
      // ── Weekly cohort funnel ──
      cohortFunnelRaw,
    ] = await Promise.all([
      // Funnel stages: count users at each level
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int                                                    AS total_signups,
          COUNT(*) FILTER (WHERE "emailVerified" = true)::int              AS email_verified,
          COUNT(*) FILTER (WHERE "profileCompleteness" > 0)::int           AS profile_started,
          COUNT(*) FILTER (WHERE "profileCompleteness" >= 30)::int         AS profile_basic,
          COUNT(*) FILTER (WHERE "profileCompleteness" >= 60)::int         AS profile_good,
          COUNT(*) FILTER (WHERE "profileCompleteness" >= 80)::int         AS profile_complete,
          COUNT(*) FILTER (WHERE "cvFileKey" IS NOT NULL)::int             AS cv_uploaded,
          COUNT(*) FILTER (WHERE "cvParsedAt" IS NOT NULL)::int            AS cv_parsed,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id))::int AS wallet_connected,
          COUNT(*) FILTER (WHERE "profilePhotoStatus" = 'approved')::int   AS photo_uploaded,
          COUNT(*) FILTER (WHERE array_length(skills, 1) > 0)::int         AS has_skills,
          COUNT(*) FILTER (WHERE bio IS NOT NULL AND LENGTH(bio) > 0)::int AS has_bio,
          COUNT(*) FILTER (WHERE location IS NOT NULL)::int                AS has_location,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Service" s WHERE s."humanId" = h.id))::int AS has_service
        FROM "Human" h
      ` as Promise<Record<string, number>[]>,

      // Source quality: UTM source → conversion through funnel (last 90d)
      prisma.$queryRaw`
        SELECT
          COALESCE(h."utmSource", 'direct') AS source,
          COUNT(*)::int AS signups,
          COUNT(*) FILTER (WHERE h."emailVerified" = true)::int AS verified,
          COUNT(*) FILTER (WHERE h."profileCompleteness" >= 30)::int AS profile_basic,
          COUNT(*) FILTER (WHERE h."cvFileKey" IS NOT NULL)::int AS with_cv,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id))::int AS with_wallet,
          COUNT(*) FILTER (WHERE h."profileCompleteness" >= 60)::int AS profile_good,
          ROUND(AVG(h."profileCompleteness"))::int AS avg_completeness,
          ROUND(AVG(EXTRACT(EPOCH FROM (
            CASE WHEN h."lastActiveAt" > h."createdAt" + INTERVAL '1 hour'
              THEN h."lastActiveAt" - h."createdAt"
            END
          )) / 3600))::int AS avg_active_hours_after_signup
        FROM "Human" h
        WHERE h."createdAt" >= NOW() - INTERVAL '90 days'
        GROUP BY COALESCE(h."utmSource", 'direct')
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT 20
      ` as Promise<{
        source: string; signups: number; verified: number; profile_basic: number;
        with_cv: number; with_wallet: number; profile_good: number;
        avg_completeness: number; avg_active_hours_after_signup: number;
      }[]>,

      // Signup method per day (email vs google vs linkedin vs whatsapp)
      prisma.$queryRaw`
        WITH days AS (
          SELECT d::date AS day
          FROM generate_series((NOW() - INTERVAL '89 days')::date, NOW()::date, '1 day'::interval) d
        )
        SELECT
          d.day,
          COUNT(h.id) FILTER (WHERE h."googleId" IS NULL AND h."linkedinId" IS NULL AND h.whatsapp IS NULL)::int AS email,
          COUNT(h.id) FILTER (WHERE h."googleId" IS NOT NULL)::int AS google,
          COUNT(h.id) FILTER (WHERE h."linkedinId" IS NOT NULL)::int AS linkedin,
          COUNT(h.id) FILTER (WHERE h.whatsapp IS NOT NULL AND h."googleId" IS NULL AND h."linkedinId" IS NULL)::int AS whatsapp
        FROM days d
        LEFT JOIN "Human" h ON h."createdAt"::date = d.day
        GROUP BY d.day ORDER BY d.day
      ` as Promise<{ day: Date; email: number; google: number; linkedin: number; whatsapp: number }[]>,

      // Abandonment: users who signed up 7+ days ago, stuck at each stage
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN "emailVerified" = false THEN 'never_verified'
            WHEN "profileCompleteness" = 0 THEN 'never_started_profile'
            WHEN "profileCompleteness" < 30 THEN 'profile_minimal'
            WHEN "profileCompleteness" < 60 THEN 'profile_partial'
            WHEN "profileCompleteness" < 80 AND NOT EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id) THEN 'no_wallet'
            WHEN "profileCompleteness" >= 80 AND NOT EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id) THEN 'good_profile_no_wallet'
            ELSE 'completed'
          END AS stage,
          COUNT(*)::int AS count,
          ROUND(AVG("profileCompleteness"))::int AS avg_completeness,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - "lastActiveAt")) / 86400))::int AS avg_days_inactive
        FROM "Human" h
        WHERE "createdAt" < NOW() - INTERVAL '7 days'
        GROUP BY stage
        ORDER BY count DESC
      ` as Promise<{ stage: string; count: number; avg_completeness: number; avg_days_inactive: number }[]>,

      // Onboarding velocity: how fast users hit milestones
      prisma.$queryRaw`
        SELECT
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
            CASE WHEN "emailVerified" = true AND "lastActiveAt" > "createdAt"
              THEN EXTRACT(EPOCH FROM ("lastActiveAt" - "createdAt")) / 3600
            END
          )::float AS median_hours_to_active,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
            CASE WHEN "cvParsedAt" IS NOT NULL
              THEN EXTRACT(EPOCH FROM ("cvParsedAt" - "createdAt")) / 3600
            END
          )::float AS median_hours_to_cv,
          AVG("profileCompleteness")::float AS avg_completeness_all,
          AVG(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN "profileCompleteness" END)::float AS avg_completeness_7d,
          AVG(CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN "profileCompleteness" END)::float AS avg_completeness_30d
        FROM "Human"
        WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      ` as Promise<{
        median_hours_to_active: number | null; median_hours_to_cv: number | null;
        avg_completeness_all: number | null; avg_completeness_7d: number | null;
        avg_completeness_30d: number | null;
      }[]>,

      // Weekly cohort funnel: signup week → milestones reached
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('week', h."createdAt")::date AS week,
          COUNT(*)::int AS signups,
          COUNT(*) FILTER (WHERE h."emailVerified" = true)::int AS verified,
          COUNT(*) FILTER (WHERE h."profileCompleteness" >= 30)::int AS profile_basic,
          COUNT(*) FILTER (WHERE h."cvFileKey" IS NOT NULL)::int AS with_cv,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Wallet" w WHERE w."humanId" = h.id))::int AS with_wallet,
          COUNT(*) FILTER (WHERE h."profileCompleteness" >= 60)::int AS profile_good,
          COUNT(*) FILTER (WHERE h."lastActiveAt" > h."createdAt" + INTERVAL '7 days')::int AS retained_7d,
          ROUND(AVG(h."profileCompleteness"))::int AS avg_completeness
        FROM "Human" h
        WHERE h."createdAt" >= NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', h."createdAt")
        ORDER BY week DESC
      ` as Promise<{
        week: Date; signups: number; verified: number; profile_basic: number;
        with_cv: number; with_wallet: number; profile_good: number;
        retained_7d: number; avg_completeness: number;
      }[]>,
    ]);

    const funnel = funnelStagesRaw[0] || {};
    const velocity = velocityRaw[0] || {};

    res.json({
      funnel,
      sourceQuality: sourceQualityRaw,
      signupMethodsByDay: signupMethodsByDayRaw.map(r => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        email: r.email, google: r.google, linkedin: r.linkedin, whatsapp: r.whatsapp,
      })),
      abandonment: abandonmentRaw,
      velocity: {
        medianHoursToActive: velocity.median_hours_to_active != null ? Math.round(velocity.median_hours_to_active * 10) / 10 : null,
        medianHoursToCv: velocity.median_hours_to_cv != null ? Math.round(velocity.median_hours_to_cv * 10) / 10 : null,
        avgCompletenessAll: Math.round(Number(velocity.avg_completeness_all) || 0),
        avgCompleteness7d: Math.round(Number(velocity.avg_completeness_7d) || 0),
        avgCompleteness30d: Math.round(Number(velocity.avg_completeness_30d) || 0),
      },
      cohortFunnel: cohortFunnelRaw.map(r => ({
        week: new Date(r.week).toISOString().slice(0, 10),
        signups: r.signups, verified: r.verified, profileBasic: r.profile_basic,
        withCv: r.with_cv, withWallet: r.with_wallet, profileGood: r.profile_good,
        retained7d: r.retained_7d, avgCompleteness: r.avg_completeness,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin funnel stats error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/users — Paginated users list
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const verified = req.query.verified as string;
    const sort = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    const catchAll = req.query.catchAll as string;

    const allowedSorts = ['createdAt', 'name', 'email', 'lastActiveAt'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (verified === 'true') where.emailVerified = true;
    if (verified === 'false') where.emailVerified = false;
    if (catchAll === 'true') where.isCatchAll = true;
    if (catchAll === 'false') where.isCatchAll = false;

    const [users, total] = await Promise.all([
      prisma.human.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          location: true,
          isAvailable: true,
          emailVerified: true,
          referralCode: true,
          role: true,
          isCatchAll: true,
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              jobs: true,
              reviews: true,
              services: true,
            },
          },
        },
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.human.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin users error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/people/filter-options — Distinct values for filter dropdowns
router.get('/people/filter-options', async (_req: AuthRequest, res) => {
  try {
    // Get all distinct locations and extract countries
    const locationsRaw = await prisma.human.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ['location'],
    });
    const countrySet = new Set<string>();
    for (const row of locationsRaw) {
      if (!row.location) continue;
      const country = countryFromLocation(row.location);
      if (country !== 'Unknown') countrySet.add(country);
    }
    const countries = [...countrySet].sort();

    // Get all distinct skills
    const skillsRaw = await prisma.human.findMany({
      where: { skills: { isEmpty: false } },
      select: { skills: true },
    });
    const skillSet = new Set<string>();
    for (const row of skillsRaw) {
      for (const s of row.skills) skillSet.add(s);
    }
    const skills = [...skillSet].sort();

    // Get career positions that have applications
    const careerPositions = await prisma.careerApplication.groupBy({
      by: ['positionId', 'positionTitle'],
      _count: true,
    });

    res.json({
      countries,
      skills,
      careerPositions: careerPositions.map((p) => ({ id: p.positionId, title: p.positionTitle, count: p._count })),
    });
  } catch (error) {
    logger.error({ err: error }, 'People filter options error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/people — Enriched, filterable users list
router.get('/people', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const search = (req.query.search as string) || '';
    const sort = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 'asc' : ('desc' as const);

    const country = (req.query.country as string) || '';
    const skillsParam = (req.query.skills as string) || '';
    const hasCareerApplication = req.query.hasCareerApplication === 'true';
    const careerPositionId = (req.query.careerPositionId as string) || '';
    const affiliatedBy = (req.query.affiliatedBy as string) || '';
    const hasReferrals = req.query.hasReferrals === 'true';
    const availability = req.query.availability as string;
    const hasPhoto = req.query.hasPhoto === 'true';

    const allowedSorts = ['createdAt', 'name', 'email', 'lastActiveAt'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Country filter: match last segment of location field
    if (country) {
      where.location = { endsWith: country, mode: 'insensitive' };
    }

    // Skills filter: match users who have ANY of the listed skills
    if (skillsParam) {
      const skillsList = skillsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (skillsList.length > 0) {
        where.skills = { hasSome: skillsList };
      }
    }

    // Career application filter
    if (hasCareerApplication || careerPositionId) {
      where.careerApplications = { some: careerPositionId ? { positionId: careerPositionId } : {} };
    }

    // Affiliated by: users referred by a specific user
    if (affiliatedBy) {
      where.referredBy = affiliatedBy;
    }

    // Has referrals: users who have referred at least one person
    if (hasReferrals) {
      // Use a raw subquery approach: find IDs that appear in referredBy
      const referrerIds = await prisma.human.findMany({
        where: { referredBy: { not: null } },
        select: { referredBy: true },
        distinct: ['referredBy'],
      });
      const ids = referrerIds.map((r) => r.referredBy).filter(Boolean) as string[];
      where.id = { ...(where.id || {}), in: ids };
    }

    if (availability === 'true') where.isAvailable = true;
    if (availability === 'false') where.isAvailable = false;

    if (hasPhoto) {
      where.profilePhotoKey = { not: null };
    }

    const [people, total] = await Promise.all([
      prisma.human.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          location: true,
          bio: true,
          skills: true,
          languages: true,
          isAvailable: true,
          emailVerified: true,
          linkedinVerified: true,
          githubVerified: true,
          referralCode: true,
          referredBy: true,
          role: true,
          createdAt: true,
          lastActiveAt: true,
          profilePhotoKey: true,
          profilePhotoStatus: true,
          featuredConsent: true,
          featuredInviteSentAt: true,
          _count: {
            select: { jobs: true, reviews: true, services: true },
          },
          careerApplications: {
            select: { positionId: true, positionTitle: true, status: true },
          },
        },
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.human.count({ where }),
    ]);

    // Enrich with referredByName and referralCount
    const referrerIds = [...new Set(people.map((p) => p.referredBy).filter(Boolean))] as string[];
    const referrers = referrerIds.length > 0
      ? await prisma.human.findMany({ where: { id: { in: referrerIds } }, select: { id: true, name: true } })
      : [];
    const referrerMap = new Map(referrers.map((r) => [r.id, r.name]));

    // Count referrals for each person
    const personIds = people.map((p) => p.id);
    const referralCounts = await prisma.human.groupBy({
      by: ['referredBy'],
      where: { referredBy: { in: personIds } },
      _count: true,
    });
    const referralCountMap = new Map(referralCounts.map((r) => [r.referredBy, r._count]));

    // Attach signed photo URLs for people with photos
    const photoUrls = new Map<string, string>();
    await Promise.all(
      people
        .filter(p => p.profilePhotoKey && ['approved', 'pending'].includes(p.profilePhotoStatus))
        .map(async (p) => {
          try {
            const url = await getProfilePhotoSignedUrl(p.profilePhotoKey!);
            if (url) photoUrls.set(p.id, url);
          } catch { /* skip */ }
        })
    );

    const enriched = people.map((p) => ({
      ...p,
      profilePhotoUrl: photoUrls.get(p.id) || null,
      profilePhotoKey: undefined, // strip R2 key
      referredByName: p.referredBy ? referrerMap.get(p.referredBy) || null : null,
      referralCount: referralCountMap.get(p.id) || 0,
    }));

    res.json({
      people: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin people error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/people/:id/featured-invite — Send featured invite email
router.post('/people/:id/featured-invite', async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, emailVerified: true, featuredInviteSentAt: true, featuredConsent: true, emailNotifications: true },
    });

    if (!human) return res.status(404).json({ error: 'User not found' });
    if (!human.emailVerified) return res.status(400).json({ error: 'User email not verified' });
    if (human.featuredConsent) return res.status(400).json({ error: 'User already opted in' });
    if (human.featuredInviteSentAt) return res.status(400).json({ error: 'Invite already sent on ' + human.featuredInviteSentAt.toISOString().slice(0, 10) });

    const sent = await sendFeaturedInviteEmail({ to: human.email, name: human.name, humanId: human.id });
    if (!sent) return res.status(500).json({ error: 'Failed to send email' });

    await prisma.human.update({
      where: { id: human.id },
      data: { featuredInviteSentAt: new Date() },
    });

    res.json({ success: true, sentAt: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error }, 'Featured invite error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/people/export — CSV export with same filters
router.get('/people/export', async (req: AuthRequest, res) => {
  try {
    const search = (req.query.search as string) || '';
    const country = (req.query.country as string) || '';
    const skillsParam = (req.query.skills as string) || '';
    const hasCareerApplication = req.query.hasCareerApplication === 'true';
    const careerPositionId = (req.query.careerPositionId as string) || '';
    const affiliatedBy = (req.query.affiliatedBy as string) || '';
    const hasReferrals = req.query.hasReferrals === 'true';
    const availability = req.query.availability as string;
    const hasPhoto = req.query.hasPhoto === 'true';

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (country) where.location = { endsWith: country, mode: 'insensitive' };
    if (skillsParam) {
      const skillsList = skillsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (skillsList.length > 0) where.skills = { hasSome: skillsList };
    }
    if (hasCareerApplication || careerPositionId) {
      where.careerApplications = { some: careerPositionId ? { positionId: careerPositionId } : {} };
    }
    if (affiliatedBy) where.referredBy = affiliatedBy;
    if (hasReferrals) {
      const referrerIds = await prisma.human.findMany({
        where: { referredBy: { not: null } },
        select: { referredBy: true },
        distinct: ['referredBy'],
      });
      const ids = referrerIds.map((r) => r.referredBy).filter(Boolean) as string[];
      where.id = { ...(where.id || {}), in: ids };
    }
    if (availability === 'true') where.isAvailable = true;
    if (availability === 'false') where.isAvailable = false;
    if (hasPhoto) where.profilePhotoKey = { not: null };

    const people = await prisma.human.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        location: true,
        skills: true,
        languages: true,
        isAvailable: true,
        emailVerified: true,
        linkedinVerified: true,
        githubVerified: true,
        referredBy: true,
        createdAt: true,
        lastActiveAt: true,
        careerApplications: {
          select: { positionTitle: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Safety limit for export
    });

    // Get referrer names
    const referrerIds = [...new Set(people.map((p) => p.referredBy).filter(Boolean))] as string[];
    const referrers = referrerIds.length > 0
      ? await prisma.human.findMany({ where: { id: { in: referrerIds } }, select: { id: true, name: true } })
      : [];
    const referrerMap = new Map(referrers.map((r) => [r.id, r.name]));

    // Count referrals using IDs from the same query (no N+1)
    const personIds = people.map((p) => p.id);
    const referralCounts = await prisma.human.groupBy({
      by: ['referredBy'],
      where: { referredBy: { in: personIds } },
      _count: true,
    });
    const referralCountMap = new Map(referralCounts.map((r) => [r.referredBy, r._count]));

    const esc = (s: string | null | undefined) => {
      if (!s) return '';
      return `"${s.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`;
    };

    const extractCountry = (loc: string | null) => {
      if (!loc) return '';
      const parts = loc.split(',').map((s) => s.trim());
      return parts.length >= 2 ? parts[parts.length - 1] : '';
    };

    const headers = ['Name', 'Email', 'Username', 'Location', 'Country', 'Skills', 'Languages', 'Available', 'Email Verified', 'LinkedIn Verified', 'GitHub Verified', 'Career Applications', 'Referred By', 'Referral Count', 'Created', 'Last Active'];
    const rows = people.map((p) => [
      esc(p.name),
      esc(p.email),
      esc(p.username),
      esc(p.location),
      esc(extractCountry(p.location)),
      esc(p.skills.join('; ')),
      esc(p.languages.join('; ')),
      p.isAvailable ? 'Yes' : 'No',
      p.emailVerified ? 'Yes' : 'No',
      p.linkedinVerified ? 'Yes' : 'No',
      p.githubVerified ? 'Yes' : 'No',
      esc(p.careerApplications.map((a) => `${a.positionTitle} (${a.status})`).join('; ')),
      esc(p.referredBy ? (referrerMap.get(p.referredBy) || p.referredBy) : ''),
      referralCountMap.get(p.id) || 0,
      p.createdAt.toISOString(),
      p.lastActiveAt.toISOString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="people-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error({ err: error }, 'People export error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/agents — Paginated agents list
router.get('/agents', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
      where.status = status;
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          websiteUrl: true,
          contactEmail: true,
          status: true,
          activationMethod: true,
          activationTier: true,
          domainVerified: true,
          isVerified: true,
          abuseScore: true,
          abuseStrikes: true,
          lastActiveAt: true,
          createdAt: true,
          _count: {
            select: {
              jobs: true,
              reports: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agent.count({ where }),
    ]);

    res.json({
      agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin agents error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/agents/bulk — Bulk update agents
router.post('/agents/bulk', async (req: AuthRequest, res) => {
  try {
    const { agentIds, updates } = req.body;

    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: 'agentIds must be a non-empty array' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates must be an object' });
    }

    const VALID_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'];
    const VALID_TIERS = ['BASIC', 'PRO'];

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    if (updates.activationTier && !VALID_TIERS.includes(updates.activationTier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
    }

    const errors: { id: string; error: string }[] = [];
    let success = 0;

    for (const agentId of agentIds) {
      try {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (!agent) {
          errors.push({ id: agentId, error: 'Agent not found' });
          continue;
        }

        const data: any = {};

        if (updates.status) {
          data.status = updates.status;
          if (updates.status === 'ACTIVE' && agent.status !== 'ACTIVE') {
            data.activatedAt = new Date();
            data.activationMethod = 'ADMIN';
          }
        }

        if (updates.activationTier) {
          data.activationTier = updates.activationTier;
        }

        await prisma.agent.update({
          where: { id: agentId },
          data,
        });

        logger.info({ adminId: req.userId, agentId, updates }, 'Bulk agent update');
        success++;
      } catch (error) {
        errors.push({ id: agentId, error: errMsg(error) });
      }
    }

    res.json({ success, failed: errors.length, errors });
  } catch (error) {
    logger.error({ err: error }, 'Admin bulk agents error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/jobs — Paginated jobs list
router.get('/jobs', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { agentName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && ['PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'COMPLETED', 'CANCELLED', 'DISPUTED'].includes(status)) {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          priceUsdc: true,
          paymentAmount: true,
          paymentNetwork: true,
          paidAt: true,
          createdAt: true,
          acceptedAt: true,
          completedAt: true,
          human: {
            select: { id: true, name: true, email: true },
          },
          registeredAgent: {
            select: { id: true, name: true },
          },
          agentName: true,
          agentId: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin jobs error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/users/:id — Full user detail
router.get('/users/:id', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.human.findUnique({
      where: { id: req.params.id },
      include: {
        wallets: { select: { id: true, network: true, chain: true, address: true, label: true, isPrimary: true, createdAt: true } },
        services: { select: { id: true, title: true, description: true, category: true, priceMin: true, priceCurrency: true, priceUnit: true, isActive: true, createdAt: true } },
        jobs: {
          select: {
            id: true, title: true, status: true, priceUsdc: true, createdAt: true,
            agentName: true,
            registeredAgent: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        reviews: {
          select: { id: true, rating: true, comment: true, createdAt: true, jobId: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        humanReportsReceived: {
          select: {
            id: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
            reporter: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        careerApplications: {
          select: {
            id: true,
            positionId: true,
            positionTitle: true,
            about: true,
            portfolioUrl: true,
            availability: true,
            status: true,
            adminNotes: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
        },
        affiliate: true,
        affiliateReferral: true,
        _count: {
          select: {
            vouchesGiven: true,
            vouchesReceived: true,
            jobs: true,
            reviews: true,
            services: true,
            careerApplications: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const referralCount = await prisma.human.count({ where: { referredBy: user.id } });

    // Generate signed URL for profile photo
    let profilePhotoUrl: string | null = null;
    if (user.profilePhotoKey && ['approved', 'pending'].includes(user.profilePhotoStatus)) {
      try {
        profilePhotoUrl = await getProfilePhotoSignedUrl(user.profilePhotoKey);
      } catch {
        // If signed URL generation fails, just omit the photo
      }
    }

    res.json({ ...user, referralCount, profilePhotoUrl });
  } catch (error) {
    logger.error({ err: error }, 'Admin user detail error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/users/:id — Update user fields (admin override)
router.patch('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { isCatchAll } = req.body;

    const user = await prisma.human.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const data: any = {};

    if (typeof isCatchAll === 'boolean') {
      data.isCatchAll = isCatchAll;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.human.update({
      where: { id: req.params.id },
      data,
    });

    logger.info({ adminId: req.userId, userId: req.params.id, updates: data }, 'Admin user update');

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Admin user update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/agents/export — Export agents as CSV
router.get('/agents/export', async (req: AuthRequest, res) => {
  try {
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        activationTier: true,
        contactEmail: true,
        websiteUrl: true,
        lastActiveAt: true,
        createdAt: true,
        _count: {
          select: { listings: true, reports: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV header
    const headers = ['Name', 'Status', 'Tier', 'Contact Email', 'Website URL', 'Listings', 'Reports', 'Last Active At', 'Created At'];
    const rows = agents.map(agent => [
      `"${agent.name.replace(/"/g, '""')}"`,
      agent.status,
      agent.activationTier,
      agent.contactEmail ? `"${agent.contactEmail.replace(/"/g, '""')}"` : '',
      agent.websiteUrl ? `"${agent.websiteUrl.replace(/"/g, '""')}"` : '',
      agent._count.listings,
      agent._count.reports,
      agent.lastActiveAt.toISOString(),
      agent.createdAt.toISOString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="agents.csv"');
    res.send(csv);
  } catch (error) {
    logger.error({ err: error }, 'Admin agents export error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/agents/:id — Full agent detail
router.get('/agents/:id', async (req: AuthRequest, res) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        jobs: {
          select: {
            id: true, title: true, status: true, priceUsdc: true, createdAt: true,
            human: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        listings: {
          select: {
            id: true, title: true, status: true, budgetUsdc: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        reports: {
          select: {
            id: true, reason: true, description: true, status: true, createdAt: true,
            reporter: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { jobs: true, reports: true },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  } catch (error) {
    logger.error({ err: error }, 'Admin agent detail error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/agents/:id — Update agent status/tier (admin override)
router.patch('/agents/:id', async (req: AuthRequest, res) => {
  try {
    const { status, activationTier, activationExpiresAt, isVerified } = req.body;

    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const VALID_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'];
    const VALID_TIERS = ['BASIC', 'PRO'];
    const TIER_DURATIONS: Record<string, number | null> = { BASIC: null, PRO: 60 };

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (activationTier !== undefined && !VALID_TIERS.includes(activationTier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
    }
    if (isVerified !== undefined && typeof isVerified !== 'boolean') {
      return res.status(400).json({ error: 'isVerified must be a boolean' });
    }

    const data: any = {};

    if (status !== undefined) {
      data.status = status;
      // When activating a non-active agent, record activation metadata
      if (status === 'ACTIVE' && agent.status !== 'ACTIVE') {
        data.activatedAt = new Date();
        data.activationMethod = 'ADMIN';
      }
    }

    if (activationTier !== undefined) {
      data.activationTier = activationTier;
      // Compute expiration from tier duration unless custom expiration is provided
      if (activationExpiresAt === undefined) {
        const tier = activationTier;
        const days = TIER_DURATIONS[tier];
        // BASIC: null = no expiry (subject to TOS). PRO: time-limited.
        data.activationExpiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
      }
    }

    // Handle explicit activationExpiresAt (null = no expiry, string = custom date)
    if (activationExpiresAt !== undefined) {
      data.activationExpiresAt = activationExpiresAt === null ? null : new Date(activationExpiresAt);
    }

    // Handle verified status toggle
    if (isVerified !== undefined) {
      data.isVerified = isVerified;
      data.verifiedByAdminAt = isVerified ? new Date() : null;
      // Update all OPEN listings for this agent to reflect new verified status
      await prisma.listing.updateMany({
        where: { agentId: req.params.id, status: 'OPEN' },
        data: { isVerified },
      });
    }

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data,
      include: {
        jobs: {
          select: {
            id: true, title: true, status: true, priceUsdc: true, createdAt: true,
            human: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        reports: {
          select: {
            id: true, reason: true, description: true, status: true, createdAt: true,
            reporter: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { jobs: true, reports: true },
        },
      },
    });

    logger.info({ agentId: req.params.id, changes: { status, activationTier, activationExpiresAt, isVerified } }, 'Admin updated agent');
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Admin agent update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/jobs/:id — Full job detail
router.get('/jobs/:id', async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          select: { id: true, name: true, email: true, username: true },
        },
        registeredAgent: {
          select: { id: true, name: true, status: true, domainVerified: true },
        },
        messages: {
          select: {
            id: true, senderType: true, senderName: true, content: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        review: {
          select: { id: true, rating: true, comment: true, createdAt: true, humanId: true },
        },
        streamTicks: {
          select: {
            id: true, tickNumber: true, status: true, expectedAt: true, amount: true,
            txHash: true, network: true, verifiedAt: true, createdAt: true,
          },
          orderBy: { tickNumber: 'asc' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error({ err: error }, 'Admin job detail error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/jobs/:id/status — Admin updates job status
router.patch('/jobs/:id/status', async (req: AuthRequest, res) => {
  try {
    const VALID_JOB_STATUSES = ['PENDING', 'ACCEPTED', 'PAYMENT_CLAIMED', 'PAID', 'STREAMING', 'PAUSED', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED'];
    const { status } = req.body;

    if (!status || !VALID_JOB_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_JOB_STATUSES.join(', ')}` });
    }

    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const data: any = { status, lastActionBy: 'ADMIN' };
    if (status === 'COMPLETED' && !job.completedAt) data.completedAt = new Date();
    if (status === 'ACCEPTED' && !job.acceptedAt) data.acceptedAt = new Date();
    if (status === 'PAID' && !job.paidAt) data.paidAt = new Date();

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data,
    });

    logger.info({ jobId: updated.id, from: job.status, to: status, adminId: req.userId }, 'Admin updated job status');
    res.json({ id: updated.id, status: updated.status, previousStatus: job.status });
  } catch (error) {
    logger.error({ err: error }, 'Admin update job status error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/activity — Recent activity feed
router.get('/activity', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));

    const [recentJobs, recentUsers, recentAgents] = await Promise.all([
      prisma.job.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          human: { select: { name: true } },
          agentName: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.human.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.agent.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const activity = [
      ...recentJobs.map((j) => ({
        type: 'job' as const,
        id: j.id,
        description: `Job "${j.title}" (${j.status}) — ${j.human.name} / ${j.agentName || 'Unknown agent'}`,
        timestamp: j.createdAt,
      })),
      ...recentUsers.map((u) => ({
        type: 'user' as const,
        id: u.id,
        description: `${u.name} signed up (${u.email})`,
        timestamp: u.createdAt,
      })),
      ...recentAgents.map((a) => ({
        type: 'agent' as const,
        id: a.id,
        description: `Agent "${a.name}" registered (${a.status})`,
        timestamp: a.createdAt,
      })),
    ];

    activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({ activity: activity.slice(0, limit) });
  } catch (error) {
    logger.error({ err: error }, 'Admin activity error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/listings — Paginated listings
router.get('/listings', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && ['OPEN', 'CLOSED', 'EXPIRED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          budgetUsdc: true,
          status: true,
          isPro: true,
          expiresAt: true,
          createdAt: true,
          agent: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin listings error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/listings/:id — Full listing detail
router.get('/listings/:id', async (req: AuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: {
        agent: { select: { id: true, name: true, status: true, activationTier: true } },
        applications: {
          select: {
            id: true,
            pitch: true,
            status: true,
            createdAt: true,
            jobId: true,
            human: { select: { id: true, name: true, email: true, skills: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        links: {
          select: { code: true, label: true, clicks: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Strip callback secret
    const { callbackSecret, ...safeListing } = listing;
    res.json(safeListing);
  } catch (error) {
    logger.error({ err: error }, 'Admin listing detail error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Staff Management ───

// GET /api/admin/staff — List all STAFF/ADMIN users with API key status and posting stats
router.get('/staff', async (req: AuthRequest, res) => {
  try {
    const staffUsers = await prisma.human.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        capabilities: true,
        createdAt: true,
        staffApiKey: {
          select: { createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get posting stats: total per staff member
    const completionStats = await prisma.postingGroup.groupBy({
      by: ['completedById'],
      where: {
        completedById: { not: null },
        status: { in: ['POSTED', 'JOINED'] },
      },
      _count: true,
    });

    const statsMap = new Map<string, number>();
    for (const s of completionStats) {
      if (s.completedById) statsMap.set(s.completedById, s._count);
    }

    // Daily breakdown (last 30 days) via raw SQL
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyRows = await prisma.$queryRaw<Array<{ completedById: string; day: string; count: bigint }>>`
      SELECT "completedById", DATE("updatedAt") as day, COUNT(*)::bigint as count
      FROM "PostingGroup"
      WHERE "completedById" IS NOT NULL
        AND status IN ('POSTED', 'JOINED')
        AND "updatedAt" >= ${thirtyDaysAgo}
      GROUP BY "completedById", DATE("updatedAt")
      ORDER BY day DESC
    `;

    // Hourly activity via raw SQL
    const hourlyRows = await prisma.$queryRaw<Array<{ completedById: string; hour: number; count: bigint }>>`
      SELECT "completedById", EXTRACT(HOUR FROM "updatedAt")::int as hour, COUNT(*)::bigint as count
      FROM "PostingGroup"
      WHERE "completedById" IS NOT NULL
        AND status IN ('POSTED', 'JOINED')
      GROUP BY "completedById", EXTRACT(HOUR FROM "updatedAt")
      ORDER BY hour
    `;

    // Build maps for daily and hourly
    const dailyMap = new Map<string, Array<{ day: string; count: number }>>();
    for (const row of dailyRows) {
      const list = dailyMap.get(row.completedById) || [];
      list.push({ day: String(row.day), count: Number(row.count) });
      dailyMap.set(row.completedById, list);
    }

    const hourlyMap = new Map<string, Array<{ hour: number; count: number }>>();
    for (const row of hourlyRows) {
      const list = hourlyMap.get(row.completedById) || [];
      list.push({ hour: row.hour, count: Number(row.count) });
      hourlyMap.set(row.completedById, list);
    }

    const staff = staffUsers.map((u) => {
      const effectiveRole = getEffectiveRole(u.email, u.role);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: effectiveRole,
        capabilities: getEffectiveCapabilities(effectiveRole, u.capabilities),
        createdAt: u.createdAt,
        apiKeyStatus: u.staffApiKey ? 'active' as const : 'none' as const,
        apiKeyCreatedAt: u.staffApiKey?.createdAt ?? null,
        totalCompleted: statsMap.get(u.id) || 0,
        daily: dailyMap.get(u.id) || [],
        hourly: hourlyMap.get(u.id) || [],
      };
    });

    res.json({ staff });
  } catch (error) {
    logger.error({ err: error }, 'Admin staff list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/staff/:id/api-key — Generate a new API key for a staff/admin user
router.post('/staff/:id/api-key', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.human.findUnique({
      where: { id },
      select: { email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const effectiveRole = getEffectiveRole(user.email, user.role);
    if (effectiveRole !== 'STAFF' && effectiveRole !== 'ADMIN') {
      return res.status(400).json({ error: 'User must be STAFF or ADMIN to have an API key' });
    }

    // Generate key: "hp_" + 24 random hex bytes = 51 chars
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const apiKey = `hp_${randomBytes}`;
    const apiKeyPrefix = apiKey.substring(0, 8);
    const apiKeyHash = await bcrypt.hash(apiKey, BCRYPT_ROUNDS);

    // Delete existing key if any, then create new (atomic rotation)
    await prisma.$transaction([
      prisma.staffApiKey.deleteMany({ where: { humanId: id } }),
      prisma.staffApiKey.create({
        data: {
          humanId: id,
          apiKeyPrefix,
          apiKeyHash,
          createdBy: req.userId!,
        },
      }),
    ]);

    logger.info({ adminId: req.userId, staffId: id }, 'Staff API key generated');
    res.json({ apiKey, prefix: apiKeyPrefix });
  } catch (error) {
    logger.error({ err: error }, 'Staff API key generation error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// DELETE /api/admin/staff/:id/api-key — Revoke a staff user's API key
router.delete('/staff/:id/api-key', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.staffApiKey.deleteMany({
      where: { humanId: id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'No API key found for this user' });
    }

    logger.info({ adminId: req.userId, staffId: id }, 'Staff API key revoked');
    res.json({ message: 'API key revoked' });
  } catch (error) {
    logger.error({ err: error }, 'Staff API key revocation error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/staff/:id/role — Promote user to STAFF or demote to USER
router.patch('/staff/:id/role', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['USER', 'STAFF'].includes(role)) {
      return res.status(400).json({ error: 'Role must be USER or STAFF' });
    }

    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const user = await prisma.human.findUnique({
      where: { id },
      select: { email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting env-based admins
    const effectiveRole = getEffectiveRole(user.email, user.role);
    if (effectiveRole === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot change role of an admin' });
    }

    if (role === 'USER' && user.role === 'STAFF') {
      // Demoting: revoke API key + update role atomically
      await prisma.$transaction([
        prisma.staffApiKey.deleteMany({ where: { humanId: id } }),
        prisma.human.update({ where: { id }, data: { role: 'USER' } }),
      ]);
      logger.info({ adminId: req.userId, staffId: id }, 'Staff demoted to USER (key revoked)');
    } else {
      // Promoting to STAFF (or idempotent set)
      await prisma.human.update({ where: { id }, data: { role } });
      logger.info({ adminId: req.userId, staffId: id, role }, 'User role updated');
    }

    res.json({ message: `Role updated to ${role}`, id, role });
  } catch (error) {
    logger.error({ err: error }, 'Staff role update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/staff/:id/capabilities — View capabilities for a staff member
router.get('/staff/:id/capabilities', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.human.findUnique({
      where: { id },
      select: { email: true, role: true, capabilities: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const effectiveRole = getEffectiveRole(user.email, user.role);
    res.json({ capabilities: getEffectiveCapabilities(effectiveRole, user.capabilities) });
  } catch (error) {
    logger.error({ err: error }, 'Staff capabilities get error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/staff/:id/capabilities — Set capabilities for a staff member
router.patch('/staff/:id/capabilities', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { capabilities } = req.body;
    if (!Array.isArray(capabilities)) {
      return res.status(400).json({ error: 'capabilities must be an array' });
    }
    const invalid = capabilities.filter((c: string) => !isValidCapability(c));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Unknown capabilities: ${invalid.join(', ')}. Valid: ${STAFF_CAPABILITIES.join(', ')}` });
    }
    const user = await prisma.human.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.human.update({
      where: { id },
      data: { capabilities },
      select: { id: true, capabilities: true },
    });
    const effectiveRole = getEffectiveRole(user.email, user.role);
    res.json({ id: updated.id, capabilities: getEffectiveCapabilities(effectiveRole, updated.capabilities) });
  } catch (error) {
    logger.error({ err: error }, 'Staff capabilities update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/staff/:id/send-key — Email an API key to a staff member
router.post('/staff/:id/send-key', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    const user = await prisma.human.findUnique({
      where: { id },
      select: { name: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sent = await sendStaffApiKeyEmail({
      staffName: user.name,
      staffEmail: user.email,
      apiKey,
    });

    if (!sent) {
      return res.status(500).json({ error: 'Failed to send email — no email provider configured' });
    }

    logger.info({ adminId: req.userId, staffId: id }, 'Staff API key emailed');
    res.json({ message: 'API key sent via email' });
  } catch (error) {
    logger.error({ err: error }, 'Staff API key email error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Moderation Queue ───

// GET /api/admin/moderation — List moderation queue items
router.get('/moderation', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const contentType = req.query.contentType as string;

    const where: any = {};
    if (status && ['pending', 'approved', 'rejected', 'error'].includes(status)) {
      where.status = status;
    }
    if (contentType) {
      where.contentType = contentType;
    }

    const [items, total] = await Promise.all([
      prisma.moderationQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.moderationQueue.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin moderation list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/moderation/:id — Manual override of moderation decision
router.patch('/moderation/:id', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const item = await prisma.moderationQueue.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ error: 'Moderation item not found' });
    }

    // Update queue item
    const updated = await prisma.moderationQueue.update({
      where: { id: req.params.id },
      data: { status, reviewedAt: new Date() },
    });

    // Update source record based on content type
    if (item.contentType === 'profile_photo') {
      await prisma.human.update({
        where: { id: item.contentId },
        data: { profilePhotoStatus: status },
      }).catch(() => {}); // Source may have been deleted
    } else if (item.contentType === 'job_posting') {
      await prisma.job.update({
        where: { id: item.contentId },
        data: { moderationStatus: status },
      }).catch(() => {});
    } else if (item.contentType === 'human_report') {
      if (status === 'rejected') {
        await prisma.humanReport.update({
          where: { id: item.contentId },
          data: { status: 'DISMISSED' },
        }).catch(() => {});
      }
    } else if (item.contentType === 'agent_report') {
      if (status === 'rejected') {
        await prisma.agentReport.update({
          where: { id: item.contentId },
          data: { status: 'DISMISSED' },
        }).catch(() => {});
      }
    }

    logger.info({ moderationId: req.params.id, status, contentType: item.contentType, adminId: req.userId }, 'Admin moderation override');

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Admin moderation override error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Email Log & Outbox ───

router.get('/emails', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const status = req.query.status as string | undefined;
    const recipient = req.query.recipient as string | undefined;
    const type = req.query.type as string | undefined;
    const jobId = req.query.jobId as string | undefined;
    const tab = (req.query.tab as string) || 'log';

    if (tab === 'outbox') {
      // Show NotificationOutbox entries (pending retries, failed, sent via worker)
      const where: any = {};
      if (status) where.status = status;
      if (recipient) where.recipient = { contains: recipient, mode: 'insensitive' };

      const [entries, total] = await Promise.all([
        prisma.notificationOutbox.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notificationOutbox.count({ where }),
      ]);

      return res.json({ entries, total, page, limit });
    }

    // Default: EmailLog
    const where: any = {};
    if (status) where.status = status;
    if (recipient) where.recipient = { contains: recipient, mode: 'insensitive' };
    if (type) where.type = type;
    if (jobId) where.jobId = jobId;

    const [entries, total, stats] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
      prisma.emailLog.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of stats) {
      statusCounts[s.status] = s._count;
    }

    return res.json({ entries, total, page, limit, statusCounts });
  } catch (error) {
    logger.error({ err: error }, 'Admin email log error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ──────────────────────────────────────────────────────────
// WhatsApp Link Codes (admin-created accounts)
// ──────────────────────────────────────────────────────────
import { generateLinkCode } from './whatsapp.js';
import { isWhatsAppEnabled, getWhatsAppNumber } from '../lib/whatsapp.js';
import { generateReferralCode } from '../lib/referralCode.js';

// POST /api/admin/link-codes — create human with link code
router.post('/link-codes', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Create a placeholder human account
    const placeholderEmail = `linkcode_${code.replace(/-/g, '').toLowerCase()}@hp.internal`;

    const human = await prisma.human.create({
      data: {
        name: name.trim(),
        email: placeholderEmail,
        referralCode: generateReferralCode(),
        linkCode: code,
        linkCodeExpiresAt: expiresAt,
        emailNotifications: false, // placeholder email, don't send
        whatsappNotifications: true,
      },
    });

    const botNumber = getWhatsAppNumber();

    res.status(201).json({
      id: human.id,
      name: human.name,
      linkCode: code,
      expiresAt: expiresAt.toISOString(),
      whatsAppEnabled: isWhatsAppEnabled(),
      botNumber,
      message: botNumber
        ? `Tell them to text "${code}" to ${botNumber} on WhatsApp`
        : 'WhatsApp not yet configured. Code generated for when it is.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin create link code error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/link-codes — list all link-code accounts
router.get('/link-codes', async (_req: AuthRequest, res) => {
  try {
    const humans = await prisma.human.findMany({
      where: {
        email: { endsWith: '@hp.internal' },
      },
      select: {
        id: true,
        name: true,
        linkCode: true,
        linkCodeExpiresAt: true,
        whatsapp: true,
        whatsappVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const entries = humans.map(h => ({
      id: h.id,
      name: h.name,
      linkCode: h.linkCode,
      expiresAt: h.linkCodeExpiresAt?.toISOString() ?? null,
      status: h.whatsappVerified ? 'linked' as const
        : h.linkCode && h.linkCodeExpiresAt && h.linkCodeExpiresAt > new Date() ? 'pending' as const
        : 'expired' as const,
      whatsapp: h.whatsapp,
      createdAt: h.createdAt.toISOString(),
    }));

    res.json({ entries, total: entries.length });
  } catch (error) {
    logger.error({ err: error }, 'Admin list link codes error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/link-codes/:id/regenerate — new code + fresh TTL
router.post('/link-codes/:id/regenerate', async (req: AuthRequest, res) => {
  try {
    // Only allow regeneration on link-code placeholder accounts
    const existing = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: { email: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!existing.email.endsWith('@hp.internal')) {
      return res.status(400).json({ error: 'Can only regenerate codes for link-code accounts' });
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.human.update({
      where: { id: req.params.id },
      data: { linkCode: code, linkCodeExpiresAt: expiresAt },
    });

    res.json({
      id: req.params.id,
      linkCode: code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin regenerate link code error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// DELETE /api/admin/link-codes/:id — remove unlinked account
router.delete('/link-codes/:id', async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.params.id },
      select: { whatsappVerified: true, email: true },
    });

    if (!human) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (human.whatsappVerified) {
      return res.status(400).json({ error: 'Cannot delete a linked account. Unlink WhatsApp first.' });
    }

    // Only allow deleting placeholder accounts
    if (!human.email.endsWith('@hp.internal')) {
      return res.status(400).json({ error: 'Can only delete link-code placeholder accounts' });
    }

    await prisma.human.delete({ where: { id: req.params.id } });

    res.json({ message: 'Account deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Admin delete link code error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Solver Dashboard Stats ─────────────────────────────────────

router.get('/solver/stats', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalRequests,
      totalCorrect,
      totalRejected,
      requestsToday,
      requests7d,
      requests30d,
      avgSolveTime,
      tokenAggAll,
      tokenAgg30d,
      topAgents,
      recentRequests,
      telemetryByModel,
      dailyUsage,
    ] = await Promise.all([
      prisma.solverRequest.count({ where: { rejected: false } }),
      prisma.solverRequest.count({ where: { rejected: false, answer: { not: null } } }),
      prisma.solverRequest.count({ where: { rejected: true } }),
      prisma.solverRequest.count({ where: { rejected: false, createdAt: { gte: new Date(todayStr) } } }),
      prisma.solverRequest.count({ where: { rejected: false, createdAt: { gte: sevenDaysAgo } } }),
      prisma.solverRequest.count({ where: { rejected: false, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.solverRequest.aggregate({
        _avg: { solveTimeMs: true },
        where: { rejected: false, answer: { not: null } },
      }),
      // Token totals (all time)
      prisma.solverRequest.aggregate({
        _sum: { inputTokens: true, outputTokens: true },
        _avg: { inputTokens: true, outputTokens: true, llmCalls: true },
        where: { rejected: false, inputTokens: { not: null } },
      }),
      // Token totals (30d)
      prisma.solverRequest.aggregate({
        _sum: { inputTokens: true, outputTokens: true },
        where: { rejected: false, inputTokens: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.solverRequest.groupBy({
        by: ['agentId'],
        _count: true,
        where: { rejected: false, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { _count: { agentId: 'desc' } },
        take: 10,
      }),
      prisma.solverRequest.findMany({
        select: { id: true, agentId: true, challenge: true, answer: true, solveTimeMs: true, model: true, inputTokens: true, outputTokens: true, rejected: true, rejectReason: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.solverRequest.groupBy({
        by: ['model'],
        _count: true,
        _avg: { solveTimeMs: true },
        where: { rejected: false, model: { not: null } },
      }),
      prisma.solverUsage.findMany({
        where: { date: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) } },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Correctness by model (from telemetry-confirmed solves)
    const solverCorrect = await prisma.solverRequest.groupBy({
      by: ['model'],
      _count: true,
      where: { rejected: false, correct: true, model: { not: null } },
    });
    const correctByModel: Record<string, number> = {};
    for (const row of solverCorrect) if (row.model) correctByModel[row.model] = row._count;

    // Agent names
    const agentIds = topAgents.map(a => a.agentId);
    const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
    const agentNameMap: Record<string, string> = {};
    for (const a of agents) agentNameMap[a.id] = a.name;

    // Daily volume
    const dailyTotals: Record<string, number> = {};
    for (const row of dailyUsage) dailyTotals[row.date] = (dailyTotals[row.date] ?? 0) + row.count;

    // Model accuracy
    const modelStats = telemetryByModel.map(row => ({
      model: row.model!,
      total: row._count,
      correct: correctByModel[row.model!] ?? 0,
      accuracy: row._count > 0 ? ((correctByModel[row.model!] ?? 0) / row._count * 100).toFixed(1) : '0',
      avgSolveTimeMs: Math.round(row._avg.solveTimeMs ?? 0),
    }));

    // Config
    const backend = process.env.SOLVER_LLM_BACKEND ?? 'anthropic';
    const primaryModel = process.env.SOLVER_MODEL_PRIMARY ?? (backend === 'openai' ? 'gpt-4o' : 'claude-opus-4-6');
    const tiebreakerModel = process.env.SOLVER_MODEL_TIEBREAKER ?? (backend === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-6');

    // Real token stats
    const totalInputTokens = tokenAggAll._sum.inputTokens ?? 0;
    const totalOutputTokens = tokenAggAll._sum.outputTokens ?? 0;
    const avgInputPerSolve = Math.round(tokenAggAll._avg.inputTokens ?? 0);
    const avgOutputPerSolve = Math.round(tokenAggAll._avg.outputTokens ?? 0);
    const avgLlmCalls = +(tokenAggAll._avg.llmCalls ?? 0).toFixed(1);
    const input30d = tokenAgg30d._sum.inputTokens ?? 0;
    const output30d = tokenAgg30d._sum.outputTokens ?? 0;

    // Actual cost from real tokens
    const costTotal = estimateTokenCost(primaryModel, totalInputTokens, totalOutputTokens);
    const cost30d = estimateTokenCost(primaryModel, input30d, output30d);
    const costPerSolve = totalRequests > 0 ? costTotal / totalRequests : 0;

    // Model cost comparison: what would it cost with other models?
    const modelComparison = Object.entries(MODEL_PRICING).map(([model, [inputPrice, outputPrice]]) => {
      const estCost30d = (input30d * inputPrice + output30d * outputPrice) / 1_000_000;
      const estPerSolve = requests30d > 0 ? estCost30d / requests30d : 0;
      return { model, inputPrice, outputPrice, estCost30d: +estCost30d.toFixed(4), estPerSolve: +estPerSolve.toFixed(6) };
    }).sort((a, b) => a.estCost30d - b.estCost30d);

    res.json({
      overview: {
        totalSolves: totalRequests,
        successfulSolves: totalCorrect,
        rejected: totalRejected,
        successRate: totalRequests > 0 ? ((totalCorrect / totalRequests) * 100).toFixed(1) : '0',
        avgSolveTimeMs: Math.round(avgSolveTime._avg.solveTimeMs ?? 0),
        today: requestsToday,
        last7d: requests7d,
        last30d: requests30d,
      },
      config: {
        backend,
        primaryModel,
        tiebreakerModel,
        dailyLimit: 50,
        consensusMode: process.env.SOLVER_CONSENSUS_MODE ?? 'adaptive',
      },
      tokens: {
        totalInput: totalInputTokens,
        totalOutput: totalOutputTokens,
        avgInputPerSolve,
        avgOutputPerSolve,
        avgLlmCalls,
        hasData: totalInputTokens > 0,
      },
      costs: {
        total: +costTotal.toFixed(4),
        last30d: +cost30d.toFixed(4),
        perSolve: +costPerSolve.toFixed(6),
      },
      modelComparison,
      modelStats,
      topAgents: topAgents.map(a => ({
        agentId: a.agentId,
        name: agentNameMap[a.agentId] ?? a.agentId.slice(0, 8),
        solves: a._count,
      })),
      dailyVolume: dailyTotals,
      recentRequests: recentRequests.map(r => ({
        id: r.id,
        agentId: r.agentId,
        challenge: r.challenge.slice(0, 120),
        answer: r.answer,
        solveTimeMs: r.solveTimeMs,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        rejected: r.rejected,
        rejectReason: r.rejectReason,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin solver stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Solver Requests (filterable, paginated) ────────────────────

router.get('/solver/requests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filter = (req.query.filter as string) ?? 'all'; // all | solved | failed | rejected
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter === 'solved') { where.rejected = false; where.answer = { not: null }; }
    else if (filter === 'failed') { where.rejected = false; where.answer = null; }
    else if (filter === 'rejected') { where.rejected = true; }

    const [total, requests] = await Promise.all([
      prisma.solverRequest.count({ where }),
      prisma.solverRequest.findMany({
        where,
        select: {
          id: true, agentId: true, challenge: true, answer: true, correct: true,
          solveTimeMs: true, model: true, inputTokens: true, outputTokens: true,
          rejected: true, rejectReason: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Resolve agent names
    const agentIds = [...new Set(requests.map(r => r.agentId))];
    const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
    const nameMap: Record<string, string> = {};
    for (const a of agents) nameMap[a.id] = a.name;

    res.json({
      filter,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      requests: requests.map(r => ({
        ...r,
        challenge: r.challenge.slice(0, 200),
        agentName: nameMap[r.agentId] ?? r.agentId.slice(0, 8),
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin solver requests error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
