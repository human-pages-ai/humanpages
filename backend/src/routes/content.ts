import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { logStaffActivity } from '../lib/activity-logger.js';
import { publishContent, crosspostToDevTo, crosspostToHashnode } from '../lib/social-publish.js';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── API-key auth (blog engine CLI) ───

const ingestItemSchema = z.object({
  sourceTitle: z.string().min(1).optional(),
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/content/feedback — pipeline fetches recent rejection feedback (API-key auth)
router.get('/feedback', apiKeyAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    let since: Date;

    if (req.query.since) {
      since = new Date(req.query.since as string);
      if (isNaN(since.getTime())) {
        return res.status(400).json({ error: 'Invalid "since" date' });
      }
    } else {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    const items = await prisma.contentItem.findMany({
      where: {
        status: 'REJECTED',
        rejectionReason: { not: null },
        rejectedAt: { gte: since },
      },
      orderBy: { rejectedAt: 'desc' },
      take: limit,
      select: {
        sourceTitle: true,
        source: true,
        platform: true,
        rejectionReason: true,
        blogTitle: true,
        blogSlug: true,
        tweetDraft: true,
        linkedinSnippet: true,
        rejectedAt: true,
      },
    });

    res.json({ rejections: items });
  } catch (error) {
    logger.error({ err: error }, 'Content feedback error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/content — create manually
const createSchema = z.object({
  sourceTitle: z.string().optional(),
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/content/:id/reject — set REJECTED with reason
const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

router.patch('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    const updated = await prisma.contentItem.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectionReason: parsed.data.reason,
        rejectedById: req.userId || null,
        rejectedAt: new Date(),
      },
    });

    logger.info({ contentId: req.params.id, userId: req.userId, reason: parsed.data.reason }, 'Content rejected');

    if (req.userId) {
      logStaffActivity({
        humanId: req.userId,
        actionType: 'content_rejected',
        entityType: 'ContentItem',
        entityId: req.params.id,
        metadata: { platform: item.platform, sourceTitle: item.sourceTitle, reason: parsed.data.reason },
      });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Content reject error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/content/:id/crosspost — cross-post published blog to Dev.to / Hashnode
const crosspostSchema = z.object({
  platforms: z.array(z.enum(['devto', 'hashnode'])).min(1),
  tags: z.array(z.string()).max(4).optional(),
  force: z.boolean().optional(),
});

router.post('/:id/crosspost', async (req: AuthRequest, res) => {
  try {
    const parsed = crosspostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const item = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Content item not found' });

    if (item.platform !== 'BLOG') {
      return res.status(400).json({ error: 'Cross-posting is only available for BLOG items' });
    }
    if (item.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Content must be PUBLISHED before cross-posting' });
    }
    if (!item.publishedUrl) {
      return res.status(400).json({ error: 'Content must have a published URL (canonical) before cross-posting' });
    }

    const { platforms, tags, force } = parsed.data;
    const results: Record<string, any> = {};
    const updateData: any = {};
    const errors: Record<string, string> = {};

    for (const platform of platforms) {
      if (platform === 'devto') {
        if (item.devtoUrl && !force) {
          results.devto = { skipped: true, url: item.devtoUrl };
          continue;
        }
        const result = await crosspostToDevTo(item, tags);
        results.devto = result;
        if (result.success) {
          updateData.devtoUrl = result.url;
          updateData.devtoArticleId = result.externalId;
        } else if (result.manualInstructions) {
          results.devto.manualInstructions = result.manualInstructions;
        } else {
          errors.devto = result.error || 'Unknown error';
        }
      }

      if (platform === 'hashnode') {
        if (item.hashnodeUrl && !force) {
          results.hashnode = { skipped: true, url: item.hashnodeUrl };
          continue;
        }
        const result = await crosspostToHashnode(item);
        results.hashnode = result;
        if (result.success) {
          updateData.hashnodeUrl = result.url;
          updateData.hashnodePostId = result.externalId;
        } else if (result.manualInstructions) {
          results.hashnode.manualInstructions = result.manualInstructions;
        } else {
          errors.hashnode = result.error || 'Unknown error';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      updateData.crosspostErrors = {
        ...(item.crosspostErrors as Record<string, string> || {}),
        ...errors,
      };
    }

    const updated = Object.keys(updateData).length > 0
      ? await prisma.contentItem.update({ where: { id: req.params.id }, data: updateData })
      : item;

    logger.info({ contentId: req.params.id, platforms, results }, 'Content cross-post attempt');

    if (req.userId) {
      logStaffActivity({
        humanId: req.userId,
        actionType: 'content_crossposted',
        entityType: 'ContentItem',
        entityId: req.params.id,
        metadata: { platforms, results },
      });
    }

    res.json({ ...updated, crosspostResults: results });
  } catch (error) {
    logger.error({ err: error }, 'Content crosspost error');
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

export default router;
