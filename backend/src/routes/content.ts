import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { logStaffActivity } from '../lib/activity-logger.js';
import { publishContent } from '../lib/social-publish.js';

const router = Router();

// ─── API-key auth (blog engine CLI) ───

const ingestItemSchema = z.object({
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().optional(),
  source: z.string().optional(),
  relevanceScore: z.number().int().min(0).max(3).optional(),
  whyUs: z.string().optional(),
  tweetDraft: z.string().optional(),
  linkedinSnippet: z.string().optional(),
  blogTitle: z.string().optional().nullable(),
  blogSlug: z.string().optional().nullable(),
  blogBody: z.string().optional().nullable(),
  blogExcerpt: z.string().optional().nullable(),
  blogReadingTime: z.string().optional().nullable(),
  isFeatured: z.boolean().optional(),
});

const ingestSchema = z.object({
  items: z.array(ingestItemSchema).min(1).max(50),
});

// POST /api/admin/content/ingest — blog engine pushes generated content
router.post('/ingest', apiKeyAdmin, async (req, res) => {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const created: string[] = [];

    for (const item of parsed.data.items) {
      const shared = {
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl || null,
        source: item.source || null,
        relevanceScore: item.relevanceScore ?? null,
        whyUs: item.whyUs || null,
      };

      // Create TWITTER item if tweet draft exists
      if (item.tweetDraft) {
        const ci = await prisma.contentItem.create({
          data: {
            ...shared,
            platform: 'TWITTER',
            tweetDraft: item.tweetDraft,
          },
        });
        created.push(ci.id);
      }

      // Create LINKEDIN item if snippet exists
      if (item.linkedinSnippet) {
        const ci = await prisma.contentItem.create({
          data: {
            ...shared,
            platform: 'LINKEDIN',
            linkedinSnippet: item.linkedinSnippet,
          },
        });
        created.push(ci.id);
      }

      // Create BLOG item if full article exists
      if (item.blogBody && item.blogSlug) {
        // Check for slug collision
        const existing = await prisma.contentItem.findUnique({
          where: { blogSlug: item.blogSlug },
        });
        const slug = existing ? `${item.blogSlug}-${Date.now()}` : item.blogSlug;

        const ci = await prisma.contentItem.create({
          data: {
            ...shared,
            platform: 'BLOG',
            blogTitle: item.blogTitle || null,
            blogSlug: slug,
            blogBody: item.blogBody,
            blogExcerpt: item.blogExcerpt || null,
            blogReadingTime: item.blogReadingTime || null,
            metaDescription: item.blogExcerpt?.slice(0, 300) || null,
          },
        });
        created.push(ci.id);
      }
    }

    logger.info({ count: created.length }, 'Content items ingested');
    res.json({ created: created.length, ids: created });
  } catch (error) {
    logger.error({ err: error }, 'Content ingest error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── JWT staff/admin auth (dashboard) ───

router.use(authenticateToken, requireStaffOrAdmin);

// GET /api/admin/content/stats — counts by status and platform
router.get('/stats', async (_req, res) => {
  try {
    const [byStatus, byPlatform] = await Promise.all([
      prisma.contentItem.groupBy({ by: ['status'], _count: true }),
      prisma.contentItem.groupBy({ by: ['platform', 'status'], _count: true }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const g of byStatus) {
      statusCounts[g.status] = g._count;
    }

    const platformCounts: Record<string, Record<string, number>> = {};
    for (const g of byPlatform) {
      if (!platformCounts[g.platform]) platformCounts[g.platform] = {};
      platformCounts[g.platform][g.status] = g._count;
    }

    res.json({ byStatus: statusCounts, byPlatform: platformCounts });
  } catch (error) {
    logger.error({ err: error }, 'Content stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/content — list with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const platform = req.query.platform as string;
    const search = (req.query.search as string) || '';

    const where: any = {};

    if (status && ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'].includes(status)) {
      where.status = status;
    }

    if (platform && ['TWITTER', 'LINKEDIN', 'BLOG'].includes(platform)) {
      where.platform = platform;
    }

    if (search) {
      where.OR = [
        { sourceTitle: { contains: search, mode: 'insensitive' } },
        { tweetDraft: { contains: search, mode: 'insensitive' } },
        { linkedinSnippet: { contains: search, mode: 'insensitive' } },
        { blogTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Content list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/content/:id — single item detail
router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });
    res.json(item);
  } catch (error) {
    logger.error({ err: error }, 'Content detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/content — create manually
const createSchema = z.object({
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().optional(),
  source: z.string().optional(),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'BLOG']),
  tweetDraft: z.string().optional(),
  linkedinSnippet: z.string().optional(),
  blogTitle: z.string().optional(),
  blogSlug: z.string().optional(),
  blogBody: z.string().optional(),
  blogExcerpt: z.string().optional(),
  blogReadingTime: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const item = await prisma.contentItem.create({ data: parsed.data });
    res.status(201).json(item);
  } catch (error) {
    logger.error({ err: error }, 'Content create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/content/:id — edit draft text, status, etc.
const updateSchema = z.object({
  tweetDraft: z.string().optional(),
  linkedinSnippet: z.string().optional(),
  blogTitle: z.string().optional(),
  blogSlug: z.string().optional(),
  blogBody: z.string().optional(),
  blogExcerpt: z.string().optional(),
  blogReadingTime: z.string().optional(),
  metaDescription: z.string().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED']).optional(),
}).strict();

router.patch('/:id', async (req, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Content update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/content/:id/approve — set APPROVED
router.patch('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedById: req.userId,
        approvedAt: new Date(),
      },
    });

    logger.info({ contentId: req.params.id, userId: req.userId }, 'Content approved');

    if (req.userId) {
      logStaffActivity({
        humanId: req.userId,
        actionType: 'content_approved',
        entityType: 'ContentItem',
        entityId: req.params.id,
        metadata: { platform: item.platform, sourceTitle: item.sourceTitle },
      });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Content approve error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/content/:id/reject — set REJECTED
router.patch('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });

    logger.info({ contentId: req.params.id, userId: req.userId }, 'Content rejected');

    if (req.userId) {
      logStaffActivity({
        humanId: req.userId,
        actionType: 'content_rejected',
        entityType: 'ContentItem',
        entityId: req.params.id,
        metadata: { platform: item.platform, sourceTitle: item.sourceTitle },
      });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Content reject error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/content/:id/publish — publish via API or generate manual instructions
router.post('/:id/publish', async (req: AuthRequest, res) => {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    if (item.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Content must be APPROVED before publishing' });
    }

    const result = await publishContent(item);

    const updateData: any = {
      publishedAt: new Date(),
    };

    if (result.success) {
      updateData.status = 'PUBLISHED';
      updateData.publishedUrl = result.url;
      updateData.publishError = null;
    } else if (result.manualInstructions) {
      // API not configured — provide manual instructions but still mark as published
      updateData.status = 'PUBLISHED';
      updateData.manualInstructions = result.manualInstructions;
      updateData.publishError = null;
    } else {
      updateData.publishError = result.error;
    }

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: updateData,
    });

    logger.info({ contentId: req.params.id, platform: item.platform, success: result.success }, 'Content publish attempt');

    if (req.userId && (result.success || result.manualInstructions)) {
      logStaffActivity({
        humanId: req.userId,
        actionType: 'content_published',
        entityType: 'ContentItem',
        entityId: req.params.id,
        metadata: { platform: item.platform, sourceTitle: item.sourceTitle },
      });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Content publish error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/content/:id
router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    await prisma.contentItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Content item deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Content delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
