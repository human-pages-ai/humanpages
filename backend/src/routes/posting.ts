import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

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

// GET /api/admin/posting/stats — Counts by status + ad count
router.get('/stats', apiKeyAdmin, async (_req, res) => {
  try {
    const [statusCounts, adCount] = await Promise.all([
      prisma.postingGroup.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.adCopy.count(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of statusCounts) {
      byStatus[g.status] = g._count;
    }

    res.json({ groups: byStatus, adCount });
  } catch (error) {
    logger.error({ err: error }, 'Posting stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Browser routes (JWT + staff/admin) ───

// GET /api/admin/posting/groups — Paginated list with filters
router.get('/groups', authenticateToken, requireStaffOrAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const status = req.query.status as string;
    const language = req.query.language as string;
    const country = req.query.country as string;
    const adId = req.query.adId as string;

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

    const [groups, total] = await Promise.all([
      prisma.postingGroup.findMany({
        where,
        include: {
          ad: { select: { id: true, adNumber: true, language: true, title: true } },
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
router.patch('/groups/:id', authenticateToken, requireStaffOrAdmin, async (req: AuthRequest, res) => {
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
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Posting group update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posting/ads — List all ad copy
router.get('/ads', authenticateToken, requireStaffOrAdmin, async (_req, res) => {
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
router.get('/ads/:id', authenticateToken, requireStaffOrAdmin, async (req: AuthRequest, res) => {
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
