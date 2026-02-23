import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { jwtOrApiKey, requireStaffOrApiKey } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendPaymentOwedEmail } from '../lib/email.js';
import { logStaffActivity } from '../lib/activity-logger.js';
import { resolveIdleAlerts } from '../lib/idle-worker.js';

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

    logStaffActivity({
      humanId,
      actionType: 'clock_in',
      entityType: 'TimeEntry',
      entityId: entry.id,
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

    logStaffActivity({
      humanId,
      actionType: 'clock_out',
      entityType: 'TimeEntry',
      entityId: entry.id,
      metadata: { duration },
    });

    // Auto-resolve any active idle alerts on clock-out
    resolveIdleAlerts(humanId).catch(() => {});

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
      select: { id: true, name: true, email: true, role: true, staffDailyRate: true, staffDailyHours: true },
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
        staffDailyRate: user.staffDailyRate ? Number(user.staffDailyRate) : null,
        staffDailyHours: user.staffDailyHours,
      };
    });

    res.json({ staff });
  } catch (error) {
    logger.error({ err: error }, 'Time tracking all-staff error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== RATE CONFIG (admin-only) =====

// PATCH /rate — Set staff daily rate + daily hours
router.patch('/rate', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { humanId, staffDailyRate, staffDailyHours } = req.body;
    if (!humanId) {
      return res.status(400).json({ error: 'humanId is required' });
    }

    const data: any = {};
    if (staffDailyRate !== undefined) data.staffDailyRate = staffDailyRate;
    if (staffDailyHours !== undefined) data.staffDailyHours = staffDailyHours;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Provide staffDailyRate and/or staffDailyHours' });
    }

    const human = await prisma.human.update({
      where: { id: humanId },
      data,
      select: { id: true, name: true, staffDailyRate: true, staffDailyHours: true },
    });

    res.json({
      id: human.id,
      name: human.name,
      staffDailyRate: human.staffDailyRate ? Number(human.staffDailyRate) : null,
      staffDailyHours: human.staffDailyHours,
    });
  } catch (error) {
    logger.error({ err: error }, 'Rate config error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PAYMENTS (admin-only CRUD) =====

// Helper: compute balance for a staff member in a date range
async function computeBalance(humanId: string, from: Date, to: Date) {
  const human = await prisma.human.findUnique({
    where: { id: humanId },
    select: { id: true, name: true, email: true, staffDailyRate: true, staffDailyHours: true },
  });

  if (!human) return null;

  const dailyRate = human.staffDailyRate ? Number(human.staffDailyRate) : 0;
  const dailyHours = human.staffDailyHours || 8;
  const hourlyRate = dailyHours > 0 ? dailyRate / dailyHours : 0;

  const [timeEntries, adjustments, payments] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { humanId, clockIn: { gte: from, lte: to }, clockOut: { not: null } },
      select: { duration: true },
    }),
    prisma.hoursAdjustment.findMany({
      where: { humanId, date: { gte: from, lte: to }, status: 'APPROVED' },
      select: { minutes: true },
    }),
    prisma.staffPayment.findMany({
      where: { humanId, paymentDate: { gte: from, lte: to } },
      select: { amountUsd: true },
    }),
  ]);

  const entryMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const adjustmentMinutes = adjustments.reduce((sum, a) => sum + a.minutes, 0);
  const workedMinutes = entryMinutes + adjustmentMinutes;
  const workedHours = workedMinutes / 60;
  const earned = workedHours * hourlyRate;
  const paid = payments.reduce((sum, p) => sum + Number(p.amountUsd), 0);
  const owed = earned - paid;

  return {
    humanId: human.id,
    name: human.name,
    email: human.email,
    staffDailyRate: dailyRate,
    staffDailyHours: dailyHours,
    hourlyRate,
    workedMinutes,
    workedHours: +workedHours.toFixed(2),
    earned: +earned.toFixed(2),
    paid: +paid.toFixed(2),
    owed: +owed.toFixed(2),
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function getMonthRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const to = toStr ? new Date(toStr) : now;
  return { from, to };
}

// POST /payments — Log a payment (admin only)
router.post('/payments', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { humanId, amountUsd, paymentDate, notes } = req.body;
    if (!humanId || amountUsd === undefined || !paymentDate) {
      return res.status(400).json({ error: 'humanId, amountUsd, and paymentDate are required' });
    }

    const payment = await prisma.staffPayment.create({
      data: {
        humanId,
        amountUsd,
        paymentDate: new Date(paymentDate),
        notes: notes || null,
        createdById: req.userId!,
      },
      include: {
        human: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
      },
    });

    // Check if money is still owed and send notification
    const { from, to } = getMonthRange();
    const balance = await computeBalance(humanId, from, to);
    if (balance && balance.owed > 0) {
      sendPaymentOwedEmail({
        staffName: balance.name,
        staffEmail: balance.email,
        hoursWorked: balance.workedHours,
        earnedAmount: balance.earned,
        totalPaid: balance.paid,
        owedAmount: balance.owed,
      }).catch((err) => logger.error({ err }, 'Failed to send payment owed email'));
    }

    res.status(201).json(payment);
  } catch (error) {
    logger.error({ err: error }, 'Create payment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments — List payments (admin: all or by humanId; staff: own)
router.get('/payments', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    const isAdmin = effectiveRole === 'ADMIN';
    const humanId = (isAdmin && req.query.humanId) ? String(req.query.humanId) : req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = { humanId };
    if (req.query.from) {
      where.paymentDate = { ...where.paymentDate, gte: new Date(req.query.from as string) };
    }
    if (req.query.to) {
      where.paymentDate = { ...where.paymentDate, lte: new Date(req.query.to as string) };
    }

    const [payments, total] = await Promise.all([
      prisma.staffPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
        include: {
          human: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.staffPayment.count({ where }),
    ]);

    res.json({
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'List payments error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /payments/:id — Edit payment (admin only)
router.patch('/payments/:id', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { amountUsd, paymentDate, notes } = req.body;
    const data: any = {};
    if (amountUsd !== undefined) data.amountUsd = amountUsd;
    if (paymentDate !== undefined) data.paymentDate = new Date(paymentDate);
    if (notes !== undefined) data.notes = notes || null;

    const payment = await prisma.staffPayment.update({
      where: { id: req.params.id },
      data,
      include: {
        human: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    res.json(payment);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Payment not found' });
    }
    logger.error({ err: error }, 'Update payment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /payments/:id — Delete payment (admin only)
router.delete('/payments/:id', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await prisma.staffPayment.delete({
      where: { id: req.params.id },
    });

    res.json({ deleted: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Payment not found' });
    }
    logger.error({ err: error }, 'Delete payment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== HOURS ADJUSTMENTS (staff + admin) =====

// POST /adjustments — Staff requests extra hours
router.post('/adjustments', async (req: AuthRequest, res) => {
  try {
    const humanId = req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { date, minutes, reason } = req.body;
    if (!date || minutes === undefined || !reason) {
      return res.status(400).json({ error: 'date, minutes, and reason are required' });
    }

    if (typeof minutes !== 'number' || minutes <= 0) {
      return res.status(400).json({ error: 'minutes must be a positive number' });
    }

    const adjustment = await prisma.hoursAdjustment.create({
      data: {
        humanId,
        date: new Date(date),
        minutes,
        reason,
      },
    });

    res.status(201).json(adjustment);
  } catch (error) {
    logger.error({ err: error }, 'Create adjustment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /adjustments — List adjustments (staff: own; admin: all/by humanId)
router.get('/adjustments', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    const isAdmin = effectiveRole === 'ADMIN';
    const humanId = (isAdmin && req.query.humanId) ? String(req.query.humanId) : (isAdmin && !req.query.humanId) ? undefined : req.userId;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (humanId) where.humanId = humanId;
    if (req.query.status) where.status = String(req.query.status).toUpperCase();

    const [adjustments, total] = await Promise.all([
      prisma.hoursAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          human: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
        },
      }),
      prisma.hoursAdjustment.count({ where }),
    ]);

    res.json({
      adjustments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'List adjustments error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /adjustments/:id — Admin approves/rejects
router.patch('/adjustments/:id', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }

    const adjustment = await prisma.hoursAdjustment.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedById: req.userId,
        reviewedAt: new Date(),
      },
      include: {
        human: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    res.json(adjustment);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Adjustment not found' });
    }
    logger.error({ err: error }, 'Update adjustment error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== BALANCE =====

// GET /balance — Owed calculation for a staff member
router.get('/balance', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    const isAdmin = effectiveRole === 'ADMIN';
    const humanId = (isAdmin && req.query.humanId) ? String(req.query.humanId) : req.userId;
    if (!humanId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { from, to } = getMonthRange(req.query.from as string, req.query.to as string);
    const balance = await computeBalance(humanId, from, to);
    if (!balance) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(balance);
  } catch (error) {
    logger.error({ err: error }, 'Balance calculation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /balance/all-staff — Admin: all staff balances
router.get('/balance/all-staff', async (req: AuthRequest, res) => {
  try {
    const effectiveRole = (req as any).effectiveRole;
    if (effectiveRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { from, to } = getMonthRange(req.query.from as string, req.query.to as string);

    const staffUsers = await prisma.human.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] } },
      select: { id: true },
    });

    const balances = await Promise.all(
      staffUsers.map((u) => computeBalance(u.id, from, to))
    );

    res.json({ balances: balances.filter(Boolean) });
  } catch (error) {
    logger.error({ err: error }, 'All staff balance error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
