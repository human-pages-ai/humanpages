import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

const PLATFORMS = [
  'WISE', 'VENMO', 'PAYPAL', 'CASHAPP', 'REVOLUT',
  'ZELLE', 'MONZO', 'N26', 'MERCADOPAGO',
] as const;

const fiatMethodLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many payment method operations. Limit: 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const addMethodSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().min(1).max(200)),
  label: z.string().trim().max(50).optional(),
});

const updateMethodSchema = z.object({
  handle: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().min(1).max(200)).optional(),
  label: z.string().trim().max(50).optional(),
}).refine(data => data.handle !== undefined || data.label !== undefined, {
  message: 'At least one of handle or label must be provided',
});

const methodSelect = {
  id: true,
  platform: true,
  handle: true,
  label: true,
  isPrimary: true,
  createdAt: true,
} as const;

// List user's fiat payment methods
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const methods = await prisma.fiatPaymentMethod.findMany({
      where: { humanId: req.userId },
      select: methodSelect,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(methods);
  } catch (error) {
    logger.error({ err: error }, 'List fiat payment methods error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new fiat payment method
router.post('/', authenticateToken, fiatMethodLimiter, async (req: AuthRequest, res) => {
  try {
    const { platform, handle, label } = addMethodSchema.parse(req.body);

    const method = await prisma.$transaction(async (tx) => {
      const count = await tx.fiatPaymentMethod.count({ where: { humanId: req.userId! } });
      return tx.fiatPaymentMethod.create({
        data: {
          humanId: req.userId!,
          platform,
          handle,
          label,
          isPrimary: count === 0,
        },
        select: methodSelect,
      });
    });

    res.status(201).json(method);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ error: 'This platform and handle combination already exists' });
    }
    logger.error({ err: error }, 'Add fiat payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a fiat payment method (handle or label only)
router.patch('/:id', authenticateToken, fiatMethodLimiter, async (req: AuthRequest, res) => {
  try {
    const updates = updateMethodSchema.parse(req.body);

    const existing = await prisma.fiatPaymentMethod.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    const method = await prisma.fiatPaymentMethod.update({
      where: { id: req.params.id },
      data: {
        ...(updates.handle !== undefined && { handle: updates.handle }),
        ...(updates.label !== undefined && { label: updates.label }),
      },
      select: methodSelect,
    });

    res.json(method);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ error: 'This platform and handle combination already exists' });
    }
    logger.error({ err: error }, 'Update fiat payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a fiat payment method
router.delete('/:id', authenticateToken, fiatMethodLimiter, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.fiatPaymentMethod.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    await prisma.fiatPaymentMethod.delete({ where: { id: req.params.id } });
    res.json({ message: 'Payment method deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete fiat payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set a fiat payment method as primary
router.post('/:id/primary', authenticateToken, fiatMethodLimiter, async (req: AuthRequest, res) => {
  try {
    const method = await prisma.$transaction(async (tx) => {
      const existing = await tx.fiatPaymentMethod.findFirst({
        where: { id: req.params.id, humanId: req.userId },
      });
      if (!existing) {
        return null;
      }
      if (existing.isPrimary) {
        return existing;
      }
      await tx.fiatPaymentMethod.updateMany({
        where: { humanId: req.userId! },
        data: { isPrimary: false },
      });
      return tx.fiatPaymentMethod.update({
        where: { id: req.params.id },
        data: { isPrimary: true },
        select: methodSelect,
      });
    });

    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    res.json(method);
  } catch (error) {
    logger.error({ err: error }, 'Set primary fiat payment method error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
