import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { runErrorMonitor } from '../lib/error-monitor.js';
import { logger } from '../lib/logger.js';

const router = Router();

function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// All routes require admin auth
router.use(authenticateToken, requireAdmin);

// GET /api/admin/watchdog — List monitored errors
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;

    const where: any = {};
    if (status) where.status = status;

    const [errors, total] = await Promise.all([
      prisma.monitoredError.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        take: Math.min(parseInt(limit, 10) || 50, 200),
        skip: parseInt(offset, 10) || 0,
      }),
      prisma.monitoredError.count({ where }),
    ]);

    res.json({ errors, total });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list monitored errors');
    res.status(500).json({ error: 'Failed to list errors', detail: errMsg(error) });
  }
});

// PATCH /api/admin/watchdog/:id — Update error status
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'alerted', 'acknowledged', 'resolved', 'ignored'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const data: any = { status };
    if (status === 'acknowledged') data.acknowledgedAt = new Date();
    if (status === 'resolved') data.resolvedAt = new Date();

    const updated = await prisma.monitoredError.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update monitored error');
    res.status(500).json({ error: 'Failed to update error', detail: errMsg(error) });
  }
});

// POST /api/admin/watchdog/scan — Trigger manual scan
router.post('/scan', async (_req: AuthRequest, res) => {
  try {
    await runErrorMonitor();
    res.json({ success: true, message: 'Scan completed' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to run manual error scan');
    res.status(500).json({ error: 'Scan failed', detail: errMsg(error) });
  }
});

// GET /api/admin/watchdog/stats — Summary stats
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const [total, newCount, alertedCount, acknowledgedCount] = await Promise.all([
      prisma.monitoredError.count(),
      prisma.monitoredError.count({ where: { status: 'new' } }),
      prisma.monitoredError.count({ where: { status: 'alerted' } }),
      prisma.monitoredError.count({ where: { status: 'acknowledged' } }),
    ]);

    res.json({ total, new: newCount, alerted: alertedCount, acknowledged: acknowledgedCount });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get watchdog stats');
    res.status(500).json({ error: 'Failed to get stats', detail: errMsg(error) });
  }
});

export default router;
