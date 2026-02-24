import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin, jwtOrApiKey, requireStaffOrApiKey } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { logStaffActivity } from '../lib/activity-logger.js';

const router = Router();

// ─── Extension distribution ───

const EXTENSION_DIR = path.join(process.cwd(), 'data', 'extension');
const EXTENSION_VERSION_FILE = path.join(EXTENSION_DIR, 'version.json');
const EXTENSION_ZIP_FILE = path.join(EXTENSION_DIR, 'chrome-extension.zip');

// GET /api/admin/posting/extension/version — Check for updates (no auth needed for lightweight check)
router.get('/extension/version', jwtOrApiKey, requireStaffOrApiKey, (_req, res) => {
  try {
    if (!fs.existsSync(EXTENSION_VERSION_FILE)) {
      return res.status(404).json({ error: 'No extension published yet' });
    }
    const info = JSON.parse(fs.readFileSync(EXTENSION_VERSION_FILE, 'utf-8'));
    res.json(info);
  } catch (error) {
    logger.error({ err: error }, 'Extension version check error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/extension/download — Download latest extension zip
router.get('/extension/download', jwtOrApiKey, requireStaffOrApiKey, (_req, res) => {
  try {
    if (!fs.existsSync(EXTENSION_ZIP_FILE)) {
      return res.status(404).json({ error: 'No extension zip found' });
    }
    res.download(EXTENSION_ZIP_FILE, 'human-pages-extension.zip');
  } catch (error) {
    logger.error({ err: error }, 'Extension download error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const VALID_TASK_TYPES = ['fb_post', 'yt_comment', 'yt_reply', 'blog_comment'] as const;

// ─── CLI routes (API-key authenticated) ───

const adCopySchema = z.object({
  adNumber: z.number().int().positive(),
  language: z.string().min(1).max(10),
  title: z.string().min(1).max(500),
  body: z.string().min(1),
});

// POST /api/admin/posting/ads — Upsert ad copy
router.post('/ads', jwtOrApiKey, requireStaffOrApiKey, async (req, res) => {
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
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

const bulkGroupsSchema = z.array(groupSchema).min(1).max(500);

// POST /api/admin/posting/groups — Add groups (single object or array)
router.post('/groups', jwtOrApiKey, requireStaffOrApiKey, async (req, res) => {
  try {
    // Accept both a single object and an array
    const input = Array.isArray(req.body) ? req.body : [req.body];
    const parsed = bulkGroupsSchema.safeParse(input);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const created = [];
    const skipped = [];
    for (const item of parsed.data) {
      const existing = await prisma.postingGroup.findFirst({ where: { url: item.url } });
      if (existing) {
        skipped.push(item.url);
        continue;
      }
      const group = await prisma.postingGroup.create({ data: item });
      created.push(group);
    }

    res.json({ created: created.length, skipped: skipped.length, groups: created });
  } catch (error) {
    logger.error({ err: error }, 'Posting groups create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/stats — Counts by status + ad count + by type
router.get('/stats', jwtOrApiKey, requireStaffOrApiKey, async (_req, res) => {
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
          { priority: 'desc' },
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
  notes: z.string().nullable().optional(),
  datePosted: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(100).optional(),
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

    if (parsed.data.priority !== undefined) {
      data.priority = parsed.data.priority;
    }

    const updated = await prisma.postingGroup.update({
      where: { id: req.params.id },
      data,
      include: {
        ad: { select: { id: true, adNumber: true, language: true, title: true } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    // Log staff activity for terminal status changes
    if (req.userId && parsed.data.status && ['POSTED', 'REJECTED', 'SKIPPED'].includes(parsed.data.status)) {
      const actionMap: Record<string, string> = { POSTED: 'posting_posted', REJECTED: 'posting_rejected', SKIPPED: 'posting_skipped' };
      logStaffActivity({
        humanId: req.userId,
        actionType: actionMap[parsed.data.status],
        entityType: 'PostingGroup',
        entityId: updated.id,
        metadata: { groupName: updated.name, taskType: updated.taskType },
      });
    }

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

// GET /api/admin/posting/ads — List all ad copy with group counts
router.get('/ads', jwtOrApiKey, requireStaffOrApiKey, async (_req, res) => {
  try {
    const ads = await prisma.adCopy.findMany({
      orderBy: [{ adNumber: 'asc' }, { language: 'asc' }],
      include: { _count: { select: { groups: true } } },
    });
    res.json({ ads });
  } catch (error) {
    logger.error({ err: error }, 'Posting ads list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/ads/:id — Single ad copy with group count
router.get('/ads/:id', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const ad = await prisma.adCopy.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { groups: true } } },
    });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json(ad);
  } catch (error) {
    logger.error({ err: error }, 'Posting ad detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const adCopyUpdateSchema = z.object({
  adNumber: z.number().int().positive().optional(),
  language: z.string().min(1).max(10).optional(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
});

// PATCH /api/admin/posting/ads/:id — Update ad copy (admin only)
router.patch('/ads/:id', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const parsed = adCopyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const ad = await prisma.adCopy.findUnique({ where: { id: req.params.id } });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    const updated = await prisma.adCopy.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { _count: { select: { groups: true } } },
    });

    logger.info({ adId: req.params.id, changes: Object.keys(parsed.data) }, 'Admin updated ad copy');
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Ad copy update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/posting/ads/create — Create new ad copy (admin only)
router.post('/ads/create', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const parsed = adCopySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const ad = await prisma.adCopy.create({
      data: parsed.data,
      include: { _count: { select: { groups: true } } },
    });

    logger.info({ adId: ad.id, adNumber: ad.adNumber, language: ad.language }, 'Admin created ad copy');
    res.status(201).json(ad);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'An ad with this number and language already exists' });
    }
    logger.error({ err: error }, 'Ad copy create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/posting/ads/:id — Delete ad copy (admin only, only if no groups reference it)
router.delete('/ads/:id', jwtOrApiKey, requireStaffOrApiKey, async (req: AuthRequest, res) => {
  try {
    const ad = await prisma.adCopy.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { groups: true } } },
    });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    if (ad._count.groups > 0) {
      return res.status(400).json({ error: `Cannot delete: ${ad._count.groups} groups still reference this ad. Reassign them first.` });
    }

    await prisma.adCopy.delete({ where: { id: req.params.id } });
    logger.info({ adId: req.params.id, adNumber: ad.adNumber }, 'Admin deleted ad copy');
    res.json({ message: 'Ad deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Ad copy delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
