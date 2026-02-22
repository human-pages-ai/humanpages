import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { jwtOrApiKey, requireStaffOrApiKey } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// All routes require staff or API key auth
router.use(jwtOrApiKey, requireStaffOrApiKey);

// GET /status — Current clock status for the authenticated user
router.get('/status', async (req: AuthRequest, res) => {
  try {
    const humanId = req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const openEntry = await prisma.timeEntry.findFirst({
      where: { humanId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });

    res.json({
      clockedIn: !!openEntry,
      since: openEntry?.clockIn || null,
      entryId: openEntry?.id || null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clock-in — Start a new time entry
router.post('/clock-in', async (req: AuthRequest, res) => {
  try {
    const humanId = req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check for existing open entry
    const existing = await prisma.timeEntry.findFirst({
      where: { humanId, clockOut: null },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Already clocked in',
        since: existing.clockIn,
        entryId: existing.id,
      });
    }

    const entry = await prisma.timeEntry.create({
      data: { humanId },
    });

    res.json({
      clockedIn: true,
      since: entry.clockIn,
      entryId: entry.id,
    });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking clock-in error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clock-out — Close the open time entry
router.post('/clock-out', async (req: AuthRequest, res) => {
  try {
    const humanId = req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : null;

    const openEntry = await prisma.timeEntry.findFirst({
      where: { humanId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });

    if (!openEntry) {
      return res.status(404).json({ error: 'Not currently clocked in' });
    }

    const clockOut = new Date();
    const duration = Math.round((clockOut.getTime() - openEntry.clockIn.getTime()) / 60000);

    const entry = await prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: { clockOut, duration, notes },
    });

    res.json({
      clockedIn: false,
      entry: {
        id: entry.id,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        duration: entry.duration,
        notes: entry.notes,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking clock-out error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /entries — Paginated time entries
router.get('/entries', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    const isAdmin = effectiveRole === 'ADMIN';

    // Admin can pass humanId to view other staff
    const humanId = (isAdmin && req.query.humanId) ? String(req.query.humanId) : req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = { humanId };
    if (req.query.from) {
      where.clockIn = { ...where.clockIn, gte: new Date(req.query.from as string) };
    }
    if (req.query.to) {
      where.clockIn = { ...where.clockIn, lte: new Date(req.query.to as string) };
    }

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        orderBy: { clockIn: 'desc' },
        skip,
        take: limit,
      }),
      prisma.timeEntry.count({ where }),
    ]);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking entries error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /summary — Hours summary for the authenticated user
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    const isAdmin = effectiveRole === 'ADMIN';
    const humanId = (isAdmin && req.query.humanId) ? String(req.query.humanId) : req.userId;

    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const now = new Date();

    // Start of today (UTC)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Start of this week (Monday)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    // Start of this month
    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

    const [todayEntries, weekEntries, monthEntries, openEntry] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { humanId, clockIn: { gte: todayStart }, clockOut: { not: null } },
        select: { duration: true },
      }),
      prisma.timeEntry.findMany({
        where: { humanId, clockIn: { gte: weekStart }, clockOut: { not: null } },
        select: { duration: true },
      }),
      prisma.timeEntry.findMany({
        where: { humanId, clockIn: { gte: monthStart }, clockOut: { not: null } },
        select: { duration: true },
      }),
      prisma.timeEntry.findFirst({
        where: { humanId, clockOut: null },
        select: { clockIn: true },
      }),
    ]);

    // Add partial duration of open entry if currently clocked in
    const openMinutes = openEntry
      ? Math.round((now.getTime() - openEntry.clockIn.getTime()) / 60000)
      : 0;

    const sumMinutes = (entries: { duration: number | null }[]) =>
      entries.reduce((sum, e) => sum + (e.duration || 0), 0);

    const todayMinutes = sumMinutes(todayEntries) + (openEntry && openEntry.clockIn >= todayStart ? openMinutes : 0);
    const weekMinutes = sumMinutes(weekEntries) + (openEntry && openEntry.clockIn >= weekStart ? openMinutes : 0);
    const monthMinutes = sumMinutes(monthEntries) + (openEntry && openEntry.clockIn >= monthStart ? openMinutes : 0);

    res.json({
      today: { minutes: todayMinutes, hours: +(todayMinutes / 60).toFixed(1) },
      week: { minutes: weekMinutes, hours: +(weekMinutes / 60).toFixed(1) },
      month: { minutes: monthMinutes, hours: +(monthMinutes / 60).toFixed(1) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking summary error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /all-staff — Admin only: all staff with current clock status + hours
router.get('/all-staff', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    // Get all staff/admin users
    const staffUsers = await prisma.human.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] } },
      select: { id: true, name: true, email: true, role: true },
    });

    const staffIds = staffUsers.map((s) => s.id);

    // Get all open entries and recent completed entries for these staff
    const [openEntries, todayEntries, weekEntries] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { humanId: { in: staffIds }, clockOut: null },
      }),
      prisma.timeEntry.findMany({
        where: { humanId: { in: staffIds }, clockIn: { gte: todayStart }, clockOut: { not: null } },
        select: { humanId: true, duration: true },
      }),
      prisma.timeEntry.findMany({
        where: { humanId: { in: staffIds }, clockIn: { gte: weekStart }, clockOut: { not: null } },
        select: { humanId: true, duration: true },
      }),
    ]);

    const openByHuman = new Map(openEntries.map((e) => [e.humanId, e]));

    const sumByHuman = (entries: { humanId: string; duration: number | null }[]) => {
      const map = new Map<string, number>();
      for (const e of entries) {
        map.set(e.humanId, (map.get(e.humanId) || 0) + (e.duration || 0));
      }
      return map;
    };

    const todayByHuman = sumByHuman(todayEntries);
    const weekByHuman = sumByHuman(weekEntries);

    const staff = staffUsers.map((user) => {
      const open = openByHuman.get(user.id);
      const openMinutes = open
        ? Math.round((now.getTime() - open.clockIn.getTime()) / 60000)
        : 0;

      const todayMins = (todayByHuman.get(user.id) || 0) + (open && open.clockIn >= todayStart ? openMinutes : 0);
      const weekMins = (weekByHuman.get(user.id) || 0) + (open && open.clockIn >= weekStart ? openMinutes : 0);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clockedIn: !!open,
        clockedInSince: open?.clockIn || null,
        todayHours: +(todayMins / 60).toFixed(1),
        weekHours: +(weekMins / 60).toFixed(1),
      };
    });

    res.json({ staff });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking all-staff error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
