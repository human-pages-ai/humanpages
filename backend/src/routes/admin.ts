import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, requireStaffOrAdmin, apiKeyAdmin, getEffectiveRole } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendStaffApiKeyEmail } from '../lib/email.js';
import postingRoutes from './posting.js';
import timeTrackingRoutes from './timeTracking.js';
import contentRoutes from './content.js';
import { STAFF_CAPABILITIES, isValidCapability, getEffectiveCapabilities } from '../lib/capabilities.js';

const router = Router();

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
      prisma.human.count({ where: { emailVerified: true } }),
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Content pipeline routes (API key + staff + admin) ───
router.use('/content', contentRoutes);

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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    if (capabilities.includes('ANALYST')) summary.ANALYST = 0;
    if (capabilities.includes('CREATIVE')) summary.CREATIVE = 0;
    if (capabilities.includes('GROUP_MANAGER')) summary.GROUP_MANAGER = 0;

    res.json({ capabilities, summary });
  } catch (error) {
    logger.error({ err: error }, 'Task summary error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── JWT-protected admin-only routes ───
// All routes below require authentication + admin check
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats — Aggregate dashboard stats
router.get('/stats', async (_req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersVerified,
      usersLast7d,
      usersLast30d,
      agentsTotal,
      agentsByStatus,
      jobsTotal,
      jobsByStatus,
      jobsLast7d,
      jobsLast30d,
      paymentVolumeOneTime,
      paymentVolumeStream,
      paidJobCount,
      reportsTotal,
      reportsPending,
      affiliatesTotal,
      affiliatesApproved,
      feedbackTotal,
      feedbackNew,
      humanReportsTotal,
      humanReportsPending,
      listingsTotal,
      listingsOpen,
      listingsByStatus,
      applicationsTotal,
    ] = await Promise.all([
      prisma.human.count(),
      prisma.human.count({ where: { emailVerified: true } }),
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
    ]);

    const agentStatusMap: Record<string, number> = {};
    for (const g of agentsByStatus) {
      agentStatusMap[g.status] = g._count;
    }

    const jobStatusMap: Record<string, number> = {};
    for (const g of jobsByStatus) {
      jobStatusMap[g.status] = g._count;
    }

    res.json({
      users: {
        total: usersTotal,
        verified: usersVerified,
        last7d: usersLast7d,
        last30d: usersLast30d,
      },
      agents: {
        total: agentsTotal,
        byStatus: agentStatusMap,
      },
      jobs: {
        total: jobsTotal,
        byStatus: jobStatusMap,
        last7d: jobsLast7d,
        last30d: jobsLast30d,
        paymentVolume: (paymentVolumeOneTime._sum.paymentAmount?.toNumber() ?? 0) + (paymentVolumeStream._sum.streamTotalPaid?.toNumber() ?? 0),
        paidJobCount,
      },
      reports: {
        total: reportsTotal,
        pending: reportsPending,
      },
      affiliates: {
        total: affiliatesTotal,
        approved: affiliatesApproved,
      },
      feedback: {
        total: feedbackTotal,
        new: feedbackNew,
      },
      humanReports: {
        total: humanReportsTotal,
        pending: humanReportsPending,
      },
      listings: {
        total: listingsTotal,
        open: listingsOpen,
        byStatus: Object.fromEntries(listingsByStatus.map(g => [g.status, g._count])),
        applications: applicationsTotal,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin stats error');
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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

    res.json({ ...user, referralCount });
  } catch (error) {
    logger.error({ err: error }, 'Admin user detail error');
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/agents/:id — Update agent status/tier (admin override)
router.patch('/agents/:id', async (req: AuthRequest, res) => {
  try {
    const { status, activationTier, activationExpiresAt } = req.body;

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

    logger.info({ agentId: req.params.id, changes: { status, activationTier, activationExpiresAt } }, 'Admin updated agent');
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Admin agent update error');
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
            human: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
