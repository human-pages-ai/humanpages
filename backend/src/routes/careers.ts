import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_POSITION_IDS = [
  'digital-marketer', 'content-creator', 'virtual-assistant',
  'influencer-outreach', 'customer-relations', 'community-manager',
  'graphic-designer', 'copywriter', 'sales-development',
  'software-engineer', 'video-editor', 'general',
  // Legacy IDs kept for backwards compatibility with existing applications
  'product-designer', 'qa-tester',
] as const;

const VALID_AVAILABILITIES = ['flexible', 'part-time', 'full-time'] as const;

const applySchema = z.object({
  positionId:    z.enum(VALID_POSITION_IDS),
  positionTitle: z.string().min(1).max(100),
  about:         z.string().min(1).max(500).transform((s) => s.trim()),
  portfolioUrl:  z.string().url().max(500).optional().or(z.literal('')).transform((s) => s || null),
  availability:  z.enum(VALID_AVAILABILITIES).default('flexible'),
});

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const applyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 applications per hour per IP
  message: { error: 'Too many applications. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
  validate: false,
});

// ─── POST /api/careers/apply ─────────────────────────────────────────────────

router.post(
  '/apply',
  applyRateLimiter,
  authenticateToken,
  requireEmailVerified,
  async (req, res) => {
    const authReq = req as AuthRequest;
    const humanId = authReq.userId!;

    // Validate body
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { positionId, positionTitle, about, portfolioUrl, availability } = parsed.data;

    // Capture IP + UA for fraud prevention (never exposed to frontend)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string)?.slice(0, 500) || null;

    try {
      // Upsert: one application per human per position (update if re-applying)
      const application = await prisma.careerApplication.upsert({
        where: { humanId_positionId: { humanId, positionId } },
        update: {
          about,
          portfolioUrl,
          availability,
          positionTitle,
          ipAddress,
          userAgent,
          status: 'PENDING', // Reset status on re-apply
        },
        create: {
          humanId,
          positionId,
          positionTitle,
          about,
          portfolioUrl,
          availability,
          ipAddress,
          userAgent,
        },
      });

      // Analytics
      trackServerEvent(humanId, 'career_application_submitted', {
        positionId,
        availability,
        hasPortfolio: !!portfolioUrl,
      });

      logger.info({ humanId, positionId, applicationId: application.id }, 'Career application submitted');

      return res.status(201).json({
        id: application.id,
        positionId: application.positionId,
        status: application.status,
        createdAt: application.createdAt,
      });
    } catch (err: any) {
      logger.error({ err, humanId, positionId }, 'Failed to save career application');
      return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
    }
  }
);

// ─── GET /api/careers/my-applications ────────────────────────────────────────

router.get(
  '/my-applications',
  authenticateToken,
  async (req, res) => {
    const authReq = req as AuthRequest;
    const humanId = authReq.userId!;

    try {
      const [applications, human] = await Promise.all([
        prisma.careerApplication.findMany({
          where: { humanId },
          select: {
            id: true,
            positionId: true,
            positionTitle: true,
            status: true,
            availability: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.human.findUnique({
          where: { id: humanId },
          select: { location: true },
        }),
      ]);

      return res.json(applications.map((app) => ({
        ...app,
        location: human?.location ?? null,
      })));
    } catch (err: any) {
      logger.error({ err, humanId }, 'Failed to fetch career applications');
      return res.status(500).json({ error: 'Failed to load applications.' });
    }
  }
);

export default router;
