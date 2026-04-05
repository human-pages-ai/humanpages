import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey, isValidPushEndpoint, isPushConfigured } from '../lib/push.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Rate limit subscribe endpoint: 5 requests per minute per IP
const subscribeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many subscription requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

// Max subscriptions per user (prevent table bloat)
const MAX_SUBSCRIPTIONS_PER_USER = 10;

// GET /api/push/vapid-key — public, returns VAPID public key
router.get('/vapid-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ vapidPublicKey: key });
});

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(128),
    auth: z.string().min(1).max(64),
  }),
  userAgent: z.string().max(500).optional(),
});

// POST /api/push/subscribe — auth required, rate limited
router.post('/subscribe', subscribeRateLimiter, authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isPushConfigured()) {
      return res.status(503).json({ error: 'Push notifications not configured' });
    }

    const data = subscribeSchema.parse(req.body);

    // SSRF protection: validate endpoint against known push service domains
    if (!isValidPushEndpoint(data.endpoint)) {
      return res.status(400).json({
        error: 'Invalid push endpoint',
        message: 'Push subscription endpoint must be from a recognized push service.',
      });
    }

    // Per-user subscription cap
    const existingCount = await prisma.pushSubscription.count({
      where: { humanId: req.userId! },
    });
    // Allow upsert of existing endpoint even if at cap
    const isExisting = await prisma.pushSubscription.findFirst({
      where: { humanId: req.userId!, endpoint: data.endpoint },
      select: { id: true },
    });
    if (!isExisting && existingCount >= MAX_SUBSCRIPTIONS_PER_USER) {
      return res.status(400).json({
        error: 'Too many devices',
        message: `Maximum ${MAX_SUBSCRIPTIONS_PER_USER} push subscriptions per account.`,
      });
    }

    // Upsert subscription
    await prisma.pushSubscription.upsert({
      where: {
        humanId_endpoint: {
          humanId: req.userId!,
          endpoint: data.endpoint,
        },
      },
      create: {
        humanId: req.userId!,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent,
      },
      update: {
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent,
      },
    });

    // Enable push notifications on profile
    await prisma.human.update({
      where: { id: req.userId! },
      data: { pushNotifications: true },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Push subscribe error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/push/unsubscribe — auth required
router.delete('/unsubscribe', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    // Delete this specific subscription
    await prisma.pushSubscription.deleteMany({
      where: {
        humanId: req.userId!,
        endpoint,
      },
    });

    // Check if any subscriptions remain
    const remaining = await prisma.pushSubscription.count({
      where: { humanId: req.userId! },
    });

    if (remaining === 0) {
      await prisma.human.update({
        where: { id: req.userId! },
        data: { pushNotifications: false },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Push unsubscribe error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
