import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// All admin routes require authentication + admin check
router.use(authenticateToken, requireAdmin);

// GET /api/admin/me — Confirm admin status (used by frontend to gate UI)
router.get('/me', (_req, res) => {
  res.json({ isAdmin: true });
});

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
      paymentVolume,
      reportsTotal,
      reportsPending,
      affiliatesTotal,
      affiliatesApproved,
      feedbackTotal,
      feedbackNew,
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
      prisma.job.aggregate({ _sum: { paymentAmount: true }, where: { paidAt: { not: null } } }),
      prisma.agentReport.count(),
      prisma.agentReport.count({ where: { status: 'PENDING' } }),
      prisma.affiliate.count(),
      prisma.affiliate.count({ where: { status: 'APPROVED' } }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'NEW' } }),
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
        paymentVolume: paymentVolume._sum.paymentAmount?.toNumber() ?? 0,
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
        affiliate: true,
        affiliateReferral: true,
        _count: {
          select: {
            vouchesGiven: true,
            vouchesReceived: true,
            jobs: true,
            reviews: true,
            services: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const referralCount = await prisma.human.count({ where: { referredBy: user.referralCode } });

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

export default router;
