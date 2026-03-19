import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
// Currency validation relaxed — frontend offers 70+ currencies, backend accepts any valid code

const router = Router();

// Map frontend unit labels to backend enum values
const UNIT_MAP: Record<string, string> = {
  'per hour': 'HOURLY', 'hourly': 'HOURLY', 'HOURLY': 'HOURLY',
  'per task': 'FLAT_TASK', 'fixed price': 'FLAT_TASK', 'FLAT_TASK': 'FLAT_TASK',
  'per word': 'PER_WORD', 'PER_WORD': 'PER_WORD',
  'per page': 'PER_PAGE', 'PER_PAGE': 'PER_PAGE',
  'negotiable': 'NEGOTIABLE', "let's discuss": 'NEGOTIABLE', 'NEGOTIABLE': 'NEGOTIABLE',
};

const serviceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().max(100).optional().nullable(),
  priceMin: z.number().min(0).optional().nullable(),
  priceCurrency: z.string().max(10).optional().nullable(),
  priceUnit: z.string().optional().nullable().transform(v => {
    if (!v) return null;
    return UNIT_MAP[v.toLowerCase()] || v;
  }),
  isActive: z.boolean().optional(),
});

const createServiceSchema = serviceSchema.refine(
  (data) => !data.priceMin || data.priceUnit,
  { message: 'Price unit is required when a price is set', path: ['priceUnit'] },
);

// Get all services for current user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { humanId: req.userId },
    });
    res.json(services);
  } catch (error) {
    logger.error({ err: error }, 'Get services error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new service
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const parsed = createServiceSchema.parse(req.body);

    const service = await prisma.service.create({
      data: {
        title: parsed.title,
        description: parsed.description || '',
        category: parsed.category,
        subcategory: parsed.subcategory || null,
        priceMin: parsed.priceMin ?? null,
        priceCurrency: parsed.priceCurrency || 'USD',
        priceUnit: (parsed.priceUnit || null) as any,
        isActive: parsed.isActive ?? true,
        humanId: req.userId!,
      },
    });

    res.status(201).json(service);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create service error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a service
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const updates = serviceSchema.partial().parse(req.body);

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: updates as any,
    });

    res.json(service);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update service error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a service
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ message: 'Service deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete service error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
