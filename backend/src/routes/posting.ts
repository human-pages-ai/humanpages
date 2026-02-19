import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin, jwtOrApiKey, requireStaffOrApiKey } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

const VALID_TASK_TYPES = ['fb_post', 'yt_comment', 'blog_comment'] as const;

// ─── CLI routes (API-key authenticated) ───

const adCopySchema = z.object({
  adNumber: z.number().int().positive(),
  language: z.string().min(1).max(10),
  title: z.string().min(1).max(500),
  body: z.string().min(1),
});

// POST /api/admin/posting/ads — Upsert ad copy
router.post('/ads', apiKeyAdmin, async (req, res) => {
  try {
    const parsed = adCopySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { adNumber, language, title, body } = parsed.data;

    const ad = await prisma.adCopy.upsert({
      where: { adNumber_language: { adNumber, language } },
      create: { adNumber, language, title, body },
      update: { title, body },
    });

    res.json(ad);
  } catch (error) {
    logger.error({ err: error }, 'Posting ads upsert error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const groupSchema = z.object({
  name: z.string().min(1).max(500),
  url: z.string().url().max(2000),
  adId: z.string().min(1),
  language: z.string().min(1).max(10),
  country: z.string().min(1).max(100),
  taskType: z.enum(VALID_TASK_TYPES).default('fb_post'),
  campaign: z.string().max(200).optional(),
});

const bulkGroupsSchema = z.array(groupSchema).min(1).max(500);

// POST /api/admin/posting/groups — Bulk add groups
router.post('/groups', apiKeyAdmin, async (req, res) => {
  try {
    const parsed = bulkGroupsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const result = await prisma.postingGroup.createMany({
      data: parsed.data,
    });

    res.json({ created: result.count });
  } catch (error) {
    logger.error({ err: error }, 'Posting groups bulk create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/stats — Counts by status + ad count + by type
router.get('/stats', apiKeyAdmin, async (_req, res) => {
  try {
    const [statusCounts, adCount, typeCounts] = await Promise.all([
      prisma.postingGroup.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.adCopy.count(),
      prisma.postingGroup.groupBy({
        by: ['taskType'],
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of statusCounts) {
      byStatus[g.status] = g._count;
    }

    const byType: Record<string, number> = {};
    for (const g of typeCounts) {
      byType[g.taskType] = g._count;
    }

    res.json({ groups: byStatus, adCount, byType });
  } catch (error) {
    logger.error({ err: error }, 'Posting stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Browser routes (JWT + staff/admin) ───

// GET /api/admin/posting/groups — Paginated list with filters
router.get('/groups', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const status = req.query.status as string;
    const language = req.query.language as string;
    const country = req.query.country as string;
    const adId = req.query.adId as string;
    const taskType = req.query.taskType as string;
    const campaign = req.query.campaign as string;

    const where: any = {};

    if (status && ['PENDING', 'JOINED', 'POSTED', 'REJECTED', 'SKIPPED'].includes(status)) {
      where.status = status;
    }
    if (language) {
      where.language = language;
    }
    if (country) {
      where.country = country;
    }
    if (adId) {
      where.adId = adId;
    }
    if (taskType && (VALID_TASK_TYPES as readonly string[]).includes(taskType)) {
      where.taskType = taskType;
    }
    if (campaign) {
      where.campaign = campaign;
    }

    const [groups, total] = await Promise.all([
      prisma.postingGroup.findMany({
        where,
        include: {
          ad: { select: { id: true, adNumber: true, language: true, title: true } },
          completedBy: { select: { id: true, name: true } },
        },
        orderBy: [
          { ad: { adNumber: 'asc' } },
          { language: 'asc' },
          { country: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.postingGroup.count({ where }),
    ]);

    res.json({
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Posting groups list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const patchGroupSchema = z.object({
  status: z.enum(['PENDING', 'JOINED', 'POSTED', 'REJECTED', 'SKIPPED']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  datePosted: z.string().datetime().nullable().optional(),
});

// PATCH /api/admin/posting/groups/:id — Update status/notes/datePosted
router.patch('/groups/:id', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const parsed = patchGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const group = await prisma.postingGroup.findUnique({ where: { id: req.params.id } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const data: any = {};

    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      // Auto-set datePosted when marking as POSTED
      if (parsed.data.status === 'POSTED' && !group.datePosted) {
        data.datePosted = new Date();
      }
      // Track who completed the task
      if (['POSTED', 'REJECTED', 'SKIPPED'].includes(parsed.data.status)) {
        data.completedById = req.userId;
      }
      // Clear completedBy if reverting to non-terminal status
      if (['PENDING', 'JOINED'].includes(parsed.data.status)) {
        data.completedById = null;
      }
    }

    if (parsed.data.notes !== undefined) {
      data.notes = parsed.data.notes;
    }

    if (parsed.data.datePosted !== undefined) {
      data.datePosted = parsed.data.datePosted ? new Date(parsed.data.datePosted) : null;
    }

    const updated = await prisma.postingGroup.update({
      where: { id: req.params.id },
      data,
      include: {
        ad: { select: { id: true, adNumber: true, language: true, title: true } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Posting group update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/staff-stats — Staff productivity stats
router.get('/staff-stats', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const isAdmin = (req as any).effectiveRole === 'ADMIN';

    // Build where clause - staff only see their own data
    const completedWhere: any = {
      completedById: isAdmin ? { not: null } : req.userId,
      updatedAt: { gte: since },
      status: { in: ['POSTED', 'REJECTED', 'SKIPPED'] },
    };

    const [totalPending, totalCompleted, staffGroups, dailyRaw] = await Promise.all([
      prisma.postingGroup.count({ where: { status: 'PENDING' } }),
      prisma.postingGroup.count({ where: completedWhere }),
      prisma.postingGroup.groupBy({
        by: ['completedById'],
        where: completedWhere,
        _count: true,
      }),
      // Raw SQL for daily breakdown
      prisma.$queryRawUnsafe<Array<{ completedById: string; day: string; count: bigint }>>(
        `SELECT "completedById", DATE("updatedAt") as day, COUNT(*)::bigint as count
         FROM "PostingGroup"
         WHERE "completedById" IS NOT NULL
           AND "updatedAt" >= $1
           AND "status" IN ('POSTED', 'REJECTED', 'SKIPPED')
           ${!isAdmin ? `AND "completedById" = $2` : ''}
         GROUP BY "completedById", DATE("updatedAt")
         ORDER BY day DESC`,
        ...(isAdmin ? [since] : [since, req.userId!])
      ),
    ]);

    // Fetch staff names for the grouped results
    const staffIds = staffGroups.map((g) => g.completedById!).filter(Boolean);
    const staffUsers = staffIds.length > 0
      ? await prisma.human.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const staffMap = new Map(staffUsers.map((u) => [u.id, u]));

    const staff = staffGroups.map((g) => {
      const user = staffMap.get(g.completedById!);
      return {
        staffId: g.completedById!,
        staffName: user?.name || 'Unknown',
        staffEmail: user?.email || '',
        completedCount: g._count,
      };
    }).sort((a, b) => b.completedCount - a.completedCount);

    const daily = dailyRaw.map((d) => ({
      completedById: d.completedById,
      day: String(d.day),
      count: Number(d.count),
    }));

    res.json({
      period: { days, since: since.toISOString() },
      totalPending,
      totalCompleted,
      staff,
      daily,
    });
  } catch (error) {
    logger.error({ err: error }, 'Staff stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/ads — List all ad copy
router.get('/ads', jwtOrApiKey, requireStaffOrApiKey, async (_req, res) => {
  try {
    const ads = await prisma.adCopy.findMany({
      orderBy: [{ adNumber: 'asc' }, { language: 'asc' }],
    });
    res.json({ ads });
  } catch (error) {
    logger.error({ err: error }, 'Posting ads list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/ads/:id — Single ad copy
router.get('/ads/:id', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const ad = await prisma.adCopy.findUnique({ where: { id: req.params.id } });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json(ad);
  } catch (error) {
    logger.error({ err: error }, 'Posting ad detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
