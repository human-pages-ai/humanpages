import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import {
  generatePresignedUploadUrl,
  getSignedDownloadUrl,
  headObject,
  deleteR2Object,
  isStorageConfigured,
} from '../lib/storage.js';

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

const createVideoSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  conceptSnapshot: z.record(z.unknown()),
  scriptSnapshot: z.record(z.unknown()).optional(),
  tier: z.enum(['NANO', 'DRAFT', 'FINAL']).default('NANO'),
  status: z.enum(['GENERATING', 'DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  durationSeconds: z.number().positive().optional(),
  aspectRatio: z.string().default('9:16'),
  estimatedCostUsd: z.number().nonnegative().optional(),
  conceptSlug: z.string().optional(),
});

const updateVideoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  scriptSnapshot: z.record(z.unknown()).optional(),
  tier: z.enum(['NANO', 'DRAFT', 'FINAL']).optional(),
  status: z.enum(['GENERATING', 'DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  durationSeconds: z.number().positive().optional(),
  videoR2Key: z.string().optional(),
  thumbnailR2Key: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
});

// ─── GET /api/admin/videos — List videos ───

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const tier = req.query.tier as string | undefined;

    const where: any = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { assets: true, schedule: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);

    // Sign thumbnail URLs
    const videosWithUrls = await Promise.all(
      videos.map(async (v) => ({
        ...v,
        thumbnailUrl: v.thumbnailR2Key ? await getSignedDownloadUrl(v.thumbnailR2Key) : null,
      })),
    );

    res.json({
      videos: videosWithUrls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list videos');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── GET /api/admin/videos/:id — Video detail ───

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: {
        assets: { orderBy: { sceneNumber: 'asc' } },
        schedule: { orderBy: { scheduledAt: 'desc' } },
      },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Sign asset URLs
    const assetsWithUrls = await Promise.all(
      video.assets.map(async (a) => ({
        ...a,
        url: await getSignedDownloadUrl(a.r2Key),
      })),
    );

    const videoUrl = video.videoR2Key ? await getSignedDownloadUrl(video.videoR2Key) : null;
    const thumbnailUrl = video.thumbnailR2Key ? await getSignedDownloadUrl(video.thumbnailR2Key) : null;

    res.json({
      ...video,
      videoUrl,
      thumbnailUrl,
      assets: assetsWithUrls,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get video detail');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── POST /api/admin/videos — Create video ───

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createVideoSchema.parse(req.body);

    const video = await prisma.video.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        conceptSnapshot: data.conceptSnapshot as Prisma.InputJsonValue,
        scriptSnapshot: data.scriptSnapshot as Prisma.InputJsonValue | undefined,
        tier: data.tier,
        status: data.status,
        durationSeconds: data.durationSeconds,
        aspectRatio: data.aspectRatio,
        estimatedCostUsd: data.estimatedCostUsd,
        conceptSlug: data.conceptSlug,
      },
    });

    res.status(201).json(video);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Video with this slug already exists' });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    logger.error({ err }, 'Failed to create video');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── PATCH /api/admin/videos/:id — Update video ───

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateVideoSchema.parse(req.body);

    const updateData: Prisma.VideoUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scriptSnapshot !== undefined) updateData.scriptSnapshot = data.scriptSnapshot as Prisma.InputJsonValue;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.durationSeconds !== undefined) updateData.durationSeconds = data.durationSeconds;
    if (data.videoR2Key !== undefined) updateData.videoR2Key = data.videoR2Key;
    if (data.thumbnailR2Key !== undefined) updateData.thumbnailR2Key = data.thumbnailR2Key;
    if (data.generatedAt !== undefined) updateData.generatedAt = new Date(data.generatedAt);

    const video = await prisma.video.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(video);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    logger.error({ err }, 'Failed to update video');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── DELETE /api/admin/videos/:id — Delete video + R2 cleanup ───

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { assets: true },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Clean up R2 assets
    if (isStorageConfigured()) {
      const keysToDelete = video.assets.map((a) => a.r2Key);
      if (video.videoR2Key) keysToDelete.push(video.videoR2Key);
      if (video.thumbnailR2Key) keysToDelete.push(video.thumbnailR2Key);
      await Promise.all(keysToDelete.map((k) => deleteR2Object(k)));
    }

    await prisma.video.delete({ where: { id: req.params.id } });

    res.json({ message: 'Video deleted' });
  } catch (err) {
    logger.error({ err }, 'Failed to delete video');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── POST /api/admin/videos/:id/upload-url — Get presigned upload URL ───

router.post('/:id/upload-url', async (req: Request, res: Response) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ error: 'R2 storage not configured' });
    }

    const { filename, contentType, assetType, sceneNumber } = req.body;
    if (!filename || !contentType || !assetType) {
      return res.status(400).json({ error: 'filename, contentType, and assetType are required' });
    }

    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const key = `videos/${video.id}/${filename}`;
    const uploadUrl = await generatePresignedUploadUrl(key, contentType);

    res.json({ uploadUrl, key, assetType, sceneNumber });
  } catch (err) {
    logger.error({ err }, 'Failed to generate upload URL');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── POST /api/admin/videos/:id/confirm-upload — Confirm upload + create asset ───

router.post('/:id/confirm-upload', async (req: Request, res: Response) => {
  try {
    const { r2Key, assetType, filename, contentType, sceneNumber } = req.body;
    if (!r2Key || !assetType || !filename || !contentType) {
      return res.status(400).json({ error: 'r2Key, assetType, filename, contentType required' });
    }

    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Verify the object exists in R2
    let fileSize: number | undefined;
    if (isStorageConfigured()) {
      const meta = await headObject(r2Key);
      if (!meta) {
        return res.status(400).json({ error: 'Object not found in R2 — upload may have failed' });
      }
      fileSize = meta.contentLength;
    }

    const asset = await prisma.videoAsset.create({
      data: {
        videoId: video.id,
        r2Key,
        assetType,
        filename,
        contentType,
        fileSize,
        sceneNumber: sceneNumber ?? null,
      },
    });

    // Auto-set videoR2Key or thumbnailR2Key on the video
    const updateData: any = {};
    if (assetType === 'video' && !video.videoR2Key) updateData.videoR2Key = r2Key;
    if (assetType === 'thumbnail' && !video.thumbnailR2Key) updateData.thumbnailR2Key = r2Key;
    if (Object.keys(updateData).length > 0) {
      await prisma.video.update({ where: { id: video.id }, data: updateData });
    }

    res.status(201).json(asset);
  } catch (err) {
    logger.error({ err }, 'Failed to confirm upload');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

export default router;
