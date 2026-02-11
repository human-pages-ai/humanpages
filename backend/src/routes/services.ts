import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { SUPPORTED_CURRENCIES } from '../lib/exchangeRates.js';

const router = Router();

const serviceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  priceMin: z.number().min(0).optional().nullable(),
  priceCurrency: z.string().refine(
    (c) => SUPPORTED_CURRENCIES.includes(c as any),
    `Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
  ).optional(),
  priceUnit: z.enum(['HOURLY', 'FLAT_TASK', 'NEGOTIABLE']).optional().nullable(),
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
    const data = createServiceSchema.parse(req.body);

    const service = await prisma.service.create({
      data: {
        ...data,
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
      data: updates,
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
