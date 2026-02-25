import { Router } from 'express';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { Request, Response } from 'express';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── Auth ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  if (authReq.userId) {
    return requireAdmin(authReq, res, next);
  }
  next();
});

// GET / — List all career applications (paginated, filterable)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const positionId = req.query.positionId as string;
    const search = (req.query.search as string) || '';
    const sort = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (status && ['PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED', 'HIRED'].includes(status)) {
      where.status = status;
    }
    if (positionId) {
      where.positionId = positionId;
    }
    if (search) {
      where.OR = [
        { human: { name: { contains: search, mode: 'insensitive' } } },
        { human: { email: { contains: search, mode: 'insensitive' } } },
        { about: { contains: search, mode: 'insensitive' } },
        { positionTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['createdAt', 'updatedAt', 'positionTitle', 'status'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [applications, total] = await Promise.all([
      prisma.careerApplication.findMany({
        where,
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
          human: {
            select: {
              id: true,
              name: true,
              email: true,
              location: true,
              username: true,
            },
          },
        },
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.careerApplication.count({ where }),
    ]);

    // Get stats
    const [totalAll, totalPending, totalByPosition] = await Promise.all([
      prisma.careerApplication.count(),
      prisma.careerApplication.count({ where: { status: 'PENDING' } }),
      prisma.careerApplication.groupBy({
        by: ['positionId'],
        _count: true,
        orderBy: { _count: { positionId: 'desc' } },
      }),
    ]);

    const byStatus = await prisma.careerApplication.groupBy({
      by: ['status'],
      _count: true,
    });

    res.json({
      applications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        total: totalAll,
        pending: totalPending,
        byStatus: Object.fromEntries(byStatus.map(g => [g.status, g._count])),
        byPosition: Object.fromEntries(totalByPosition.map(g => [g.positionId, g._count])),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Career applications list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /stats — Quick stats for career applications
router.get('/stats', async (_req, res) => {
  try {
    const [total, byStatus, byPosition, recent7d] = await Promise.all([
      prisma.careerApplication.count(),
      prisma.careerApplication.groupBy({ by: ['status'], _count: true }),
      prisma.careerApplication.groupBy({ by: ['positionId', 'positionTitle'], _count: true, orderBy: { _count: { positionId: 'desc' } } }),
      prisma.careerApplication.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    res.json({
      total,
      recent7d,
      byStatus: Object.fromEntries(byStatus.map(g => [g.status, g._count])),
      byPosition: byPosition.map(g => ({
        positionId: g.positionId,
        positionTitle: g.positionTitle,
        count: g._count,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Career applications stats error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /:id — Get a single career application with full details
router.get('/:id', async (req, res) => {
  try {
    const application = await prisma.careerApplication.findUnique({
      where: { id: req.params.id },
      include: {
        human: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            location: true,
            bio: true,
            skills: true,
            linkedinUrl: true,
            githubUrl: true,
            websiteUrl: true,
            linkedinVerified: true,
            githubVerified: true,
            createdAt: true,
            isAvailable: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    logger.error({ err: error }, 'Career application detail error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /bulk-status — Bulk update status (MUST be before /:id to avoid Express matching "bulk-status" as :id)
router.patch('/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (!status || !['PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED', 'HIRED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await prisma.careerApplication.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    logger.info({ count: result.count, status }, 'Career applications bulk status update');
    res.json({ updated: result.count });
  } catch (error) {
    logger.error({ err: error }, 'Career applications bulk update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /:id — Update application status and admin notes
router.patch('/:id', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (status && !['PENDING', 'REVIEWED', 'CONTACTED', 'REJECTED', 'HIRED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (adminNotes !== undefined) data.adminNotes = String(adminNotes).slice(0, 2000);

    const updated = await prisma.careerApplication.update({
      where: { id: req.params.id },
      data,
      include: {
        human: {
          select: {
            id: true,
            name: true,
            email: true,
            location: true,
          },
        },
      },
    });

    logger.info({ applicationId: req.params.id, status, hasNotes: !!adminNotes }, 'Career application updated');
    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    logger.error({ err: error }, 'Career application update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

export default router;
