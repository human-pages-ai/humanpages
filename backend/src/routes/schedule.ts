import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getSignedDownloadUrl } from '../lib/storage.js';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── Auth: jwtOrApiKey, then require admin for JWT users ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  if (authReq.userId) {
    return requireAdmin(authReq, res, next);
  }
  next();
});

// ─── Validation schemas ───

const createScheduleSchema = z.object({
  videoId: z.string().optional(),
  contentItemId: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  imageR2Key: z.string().optional(),
  platform: z.enum(['TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'FACEBOOK', 'BLOG']),
  contentType: z.enum(['VIDEO', 'ARTICLE', 'SHORT_POST', 'IMAGE_POST']),
  scheduledAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  isAuto: z.boolean().default(false),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED']).default('DRAFT'),
  publishedUrl: z.string().optional(),
  assignedToId: z.string().optional(),
  platformMeta: z.record(z.unknown()).optional(),
});

const updateScheduleSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  platform: z.enum(['TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'FACEBOOK', 'BLOG']).optional(),
  contentType: z.enum(['VIDEO', 'ARTICLE', 'SHORT_POST', 'IMAGE_POST']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  isAuto: z.boolean().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED']).optional(),
  publishedUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  platformMeta: z.record(z.unknown()).optional(),
});

// ─── GET /api/admin/schedule — List schedule entries (calendar view) ───

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const platform = req.query.platform as string | undefined;
    const status = req.query.status as string | undefined;
    const contentType = req.query.contentType as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const where: any = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (contentType) where.contentType = contentType;

    // Date range filter — checks both scheduledAt and publishedAt
    if (from || to) {
      const dateFilters: any[] = [];
      const range: any = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      dateFilters.push({ scheduledAt: range });
      dateFilters.push({ publishedAt: range });
      where.OR = dateFilters;
    }

    const [entries, total] = await Promise.all([
      prisma.publicationSchedule.findMany({
        where,
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          video: { select: { id: true, title: true, slug: true, tier: true, thumbnailR2Key: true } },
          contentItem: { select: { id: true, sourceTitle: true, platform: true, blogTitle: true } },
          assignedTo: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.publicationSchedule.count({ where }),
    ]);

    // Sign thumbnail URLs for videos
    const entriesWithUrls = await Promise.all(
      entries.map(async (e) => ({
        ...e,
        video: e.video
          ? { ...e.video, thumbnailUrl: e.video.thumbnailR2Key ? await getSignedDownloadUrl(e.video.thumbnailR2Key) : null }
          : null,
        imageUrl: e.imageR2Key ? await getSignedDownloadUrl(e.imageR2Key) : null,
      })),
    );

    res.json({
      entries: entriesWithUrls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list schedule');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

// ─── GET /api/admin/schedule/stats — Aggregate counts ───

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [byStatus, byPlatform, byContentType] = await Promise.all([
      prisma.publicationSchedule.groupBy({ by: ['status'], _count: true }),
      prisma.publicationSchedule.groupBy({ by: ['platform'], _count: true }),
      prisma.publicationSchedule.groupBy({ by: ['contentType'], _count: true }),
    ]);

    const upcoming = await prisma.publicationSchedule.count({
      where: { status: 'SCHEDULED', scheduledAt: { gt: new Date() } },
    });

    res.json({
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r._count])),
      byContentType: Object.fromEntries(byContentType.map((r) => [r.contentType, r._count])),
      upcoming,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get schedule stats');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

// ─── POST /api/admin/schedule — Create schedule entry ───

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createScheduleSchema.parse(req.body);

    const entry = await prisma.publicationSchedule.create({
      data: {
        videoId: data.videoId,
        contentItemId: data.contentItemId,
        title: data.title,
        body: data.body,
        imageR2Key: data.imageR2Key,
        platform: data.platform,
        contentType: data.contentType,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        isAuto: data.isAuto,
        status: data.status,
        publishedUrl: data.publishedUrl,
        assignedToId: data.assignedToId,
        platformMeta: data.platformMeta as Prisma.InputJsonValue | undefined,
      },
      include: {
        video: { select: { id: true, title: true, slug: true } },
        contentItem: { select: { id: true, sourceTitle: true, platform: true } },
      },
    });

    res.status(201).json(entry);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    logger.error({ err }, 'Failed to create schedule entry');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

// ─── PATCH /api/admin/schedule/:id — Update schedule entry ───

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateScheduleSchema.parse(req.body);

    const updateData: Prisma.PublicationScheduleUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.contentType !== undefined) updateData.contentType = data.contentType;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.isAuto !== undefined) updateData.isAuto = data.isAuto;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.publishedUrl !== undefined) updateData.publishedUrl = data.publishedUrl;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.assignedToId !== undefined) updateData.assignedTo = data.assignedToId ? { connect: { id: data.assignedToId } } : { disconnect: true };
    if (data.platformMeta !== undefined) updateData.platformMeta = data.platformMeta as Prisma.InputJsonValue;

    const entry = await prisma.publicationSchedule.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(entry);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    logger.error({ err }, 'Failed to update schedule entry');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

// ─── DELETE /api/admin/schedule/:id — Remove entry ───

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.publicationSchedule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Schedule entry deleted' });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    logger.error({ err }, 'Failed to delete schedule entry');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

// ─── POST /api/admin/schedule/:id/mark-published — Manual publish confirmation ───

router.post('/:id/mark-published', async (req: Request, res: Response) => {
  try {
    const { publishedUrl, platformMeta } = req.body;

    const entry = await prisma.publicationSchedule.update({
      where: { id: req.params.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedUrl: publishedUrl || undefined,
        platformMeta: platformMeta || undefined,
        completedById: (req as AuthRequest).userId || undefined,
      },
    });

    res.json(entry);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    logger.error({ err }, 'Failed to mark as published');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(err) });
  }
});

export default router;
