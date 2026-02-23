import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { addSSEClient } from '../lib/sse-manager.js';
import jwt from 'jsonwebtoken';

const router = Router();

// GET /stream — SSE endpoint for real-time updates
// Uses ?token= query param since EventSource cannot set custom headers.
router.get('/stream', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, secret) as { userId: string };
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    addSSEClient(decoded.userId, res);
  } catch (err) {
    logger.error({ err }, 'SSE stream auth error');
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /dashboard — Full productivity dashboard data
router.get('/dashboard', async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const idleThresholdMinutes = parseInt(process.env.IDLE_THRESHOLD_MINUTES || '15', 10);
    const thresholdTime = new Date(now.getTime() - idleThresholdMinutes * 60_000);

    // Get all clocked-in staff + all staff/admin users
    const [openEntries, staffUsers, recentActivities, activeAlerts] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { clockOut: null },
        select: {
          humanId: true,
          clockIn: true,
        },
      }),
      prisma.human.findMany({
        where: { role: { in: ['STAFF', 'ADMIN'] } },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.staffActivity.findMany({
        where: { createdAt: { gte: todayStart } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          human: { select: { id: true, name: true } },
        },
      }),
      prisma.idleAlert.findMany({
        where: { status: 'ACTIVE' },
        include: {
          human: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const clockedInMap = new Map(openEntries.map((e) => [e.humanId, e]));
    const clockedInIds = openEntries.map((e) => e.humanId);

    // Get last activity time per clocked-in staff
    const lastActivityRows = clockedInIds.length > 0
      ? await prisma.$queryRaw<Array<{ humanId: string; lastActivity: Date }>>`
          SELECT "humanId", MAX("createdAt") as "lastActivity"
          FROM "StaffActivity"
          WHERE "humanId" = ANY(${clockedInIds})
          GROUP BY "humanId"
        `
      : [];
    const lastActivityMap = new Map(
      lastActivityRows.map((r) => [r.humanId, new Date(r.lastActivity)])
    );

    // Get today task counts per staff
    const todayTaskRows = await prisma.$queryRaw<Array<{ humanId: string; count: bigint }>>`
      SELECT "humanId", COUNT(*)::bigint as count
      FROM "StaffActivity"
      WHERE "createdAt" >= ${todayStart}
        AND "actionType" NOT IN ('clock_in', 'clock_out')
      GROUP BY "humanId"
    `;
    const todayTaskMap = new Map(
      todayTaskRows.map((r) => [r.humanId, Number(r.count)])
    );

    // Get today's worked minutes per staff (from closed entries)
    const todayWorkRows = await prisma.timeEntry.findMany({
      where: {
        humanId: { in: staffUsers.map((u) => u.id) },
        clockIn: { gte: todayStart },
        clockOut: { not: null },
      },
      select: { humanId: true, duration: true },
    });
    const workedMinutesMap = new Map<string, number>();
    for (const row of todayWorkRows) {
      workedMinutesMap.set(row.humanId, (workedMinutesMap.get(row.humanId) || 0) + (row.duration || 0));
    }

    // Build staff status list
    const staff = staffUsers.map((user) => {
      const clockEntry = clockedInMap.get(user.id);
      const isClockedIn = !!clockEntry;
      const lastActivityAt = lastActivityMap.get(user.id) ?? clockEntry?.clockIn ?? null;
      const idleMinutes = isClockedIn && lastActivityAt
        ? Math.round((now.getTime() - lastActivityAt.getTime()) / 60_000)
        : 0;
      const isIdle = isClockedIn && idleMinutes >= idleThresholdMinutes;

      // Add partial session time for open entry
      const closedMinutes = workedMinutesMap.get(user.id) || 0;
      const openMinutes = clockEntry
        ? Math.round((now.getTime() - clockEntry.clockIn.getTime()) / 60_000)
        : 0;
      const totalWorkedMinutes = closedMinutes + openMinutes;

      const todayTaskCount = todayTaskMap.get(user.id) || 0;
      const workedHours = totalWorkedMinutes / 60;
      const tasksPerHour = workedHours > 0 ? +(todayTaskCount / workedHours).toFixed(1) : 0;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: isClockedIn ? (isIdle ? 'idle' : 'active') : 'offline',
        clockedInSince: clockEntry?.clockIn.toISOString() ?? null,
        lastActivityAt: lastActivityAt?.toISOString() ?? null,
        idleMinutes: isClockedIn ? idleMinutes : 0,
        todayTaskCount,
        workedMinutesToday: totalWorkedMinutes,
        tasksPerHour,
      };
    });

    // Format activity feed
    const activityFeed = recentActivities.map((a) => ({
      id: a.id,
      humanId: a.humanId,
      humanName: a.human.name,
      actionType: a.actionType,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    }));

    // Format idle alerts
    const idleAlerts = activeAlerts.map((a) => ({
      id: a.id,
      humanId: a.humanId,
      humanName: a.human.name,
      idleSince: a.idleSince.toISOString(),
      idleMinutes: a.idleMinutes,
      createdAt: a.createdAt.toISOString(),
    }));

    res.json({
      staff,
      activityFeed,
      idleAlerts,
      config: { idleThresholdMinutes },
    });
  } catch (error) {
    logger.error({ err: error }, 'Productivity dashboard error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /alerts — Paginated idle alert history
router.get('/alerts', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;

    const where: any = {};
    if (status && ['ACTIVE', 'RESOLVED', 'DISMISSED'].includes(status)) {
      where.status = status;
    }

    const [alerts, total] = await Promise.all([
      prisma.idleAlert.findMany({
        where,
        include: {
          human: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.idleAlert.count({ where }),
    ]);

    res.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        humanId: a.humanId,
        humanName: a.human.name,
        status: a.status,
        idleSince: a.idleSince.toISOString(),
        idleMinutes: a.idleMinutes,
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        dismissedById: a.dismissedById,
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Productivity alerts error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /alerts/:id/dismiss — Dismiss an idle alert
router.patch('/alerts/:id/dismiss', async (req: AuthRequest, res) => {
  try {
    const alert = await prisma.idleAlert.findUnique({
      where: { id: req.params.id },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Alert is not active' });
    }

    const updated = await prisma.idleAlert.update({
      where: { id: req.params.id },
      data: {
        status: 'DISMISSED',
        dismissedById: req.userId,
      },
      include: {
        human: { select: { id: true, name: true } },
      },
    });

    res.json({
      id: updated.id,
      humanId: updated.humanId,
      humanName: updated.human.name,
      status: updated.status,
      dismissedById: updated.dismissedById,
    });
  } catch (error) {
    logger.error({ err: error }, 'Productivity alert dismiss error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /activity — Paginated staff activity log
router.get('/activity', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const humanId = req.query.humanId as string;

    const where: any = {};
    if (humanId) {
      where.humanId = humanId;
    }

    const [activities, total] = await Promise.all([
      prisma.staffActivity.findMany({
        where,
        include: {
          human: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staffActivity.count({ where }),
    ]);

    res.json({
      activities: activities.map((a) => ({
        id: a.id,
        humanId: a.humanId,
        humanName: a.human.name,
        actionType: a.actionType,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Productivity activity error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
