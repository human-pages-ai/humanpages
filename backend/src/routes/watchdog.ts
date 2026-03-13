import { Router } from 'express';
import { appendFile } from 'fs/promises';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { runErrorMonitor, analyzeWithClaude, getWatchDogHealth, getLogPaths } from '../lib/error-monitor.js';
import {
  proposeAutoFix,
  applyAutoFix,
  approveAndMergeFix,
  rejectFix,
  sendFixApprovalTelegram,
  shouldAttemptAutoFix,
} from '../lib/error-autofix.js';
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

// GET /api/admin/watchdog/health — Live watcher health & status
router.get('/health', async (_req: AuthRequest, res) => {
  try {
    const health = getWatchDogHealth();
    res.json(health);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get watchdog health');
    res.status(500).json({ error: 'Failed to get health', detail: errMsg(error) });
  }
});

// POST /api/admin/watchdog/reanalyze/:id — Re-run Claude analysis on a specific error
router.post('/reanalyze/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const monitoredError = await prisma.monitoredError.findUnique({ where: { id } });
    if (!monitoredError) {
      return res.status(404).json({ error: 'Error not found' });
    }

    const group = {
      fingerprint: monitoredError.fingerprint,
      errorType: monitoredError.errorType,
      message: monitoredError.message,
      level: monitoredError.level,
      count: monitoredError.occurrences,
      category: 'unknown' as const,
      samples: monitoredError.samplePayload ? [monitoredError.samplePayload as any] : [],
      firstTime: monitoredError.firstSeenAt.toISOString(),
      lastTime: monitoredError.lastSeenAt.toISOString(),
    };

    const analysis = await analyzeWithClaude(group);
    if (!analysis) {
      return res.status(503).json({ error: 'Claude analysis unavailable (no API key or budget exhausted)' });
    }

    const updated = await prisma.monitoredError.update({
      where: { id },
      data: {
        aiAnalysis: analysis,
        aiAnalyzedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Failed to reanalyze error');
    res.status(500).json({ error: 'Failed to reanalyze', detail: errMsg(error) });
  }
});

// GET /api/admin/watchdog/trends — Error frequency over last 24h
router.get('/trends', async (_req: AuthRequest, res) => {
  try {
    const since = new Date(Date.now() - 24 * 3600_000);

    const errors = await prisma.monitoredError.findMany({
      where: { lastSeenAt: { gte: since } },
      select: { lastSeenAt: true, occurrences: true, level: true },
      orderBy: { lastSeenAt: 'asc' },
    });

    // Group by hour
    const hourBuckets = new Map<string, { count: number; fatal: number; error: number }>();

    for (let i = 0; i < 24; i++) {
      const hour = new Date(Date.now() - (23 - i) * 3600_000);
      const key = hour.toISOString().slice(0, 13);
      hourBuckets.set(key, { count: 0, fatal: 0, error: 0 });
    }

    for (const err of errors) {
      const key = err.lastSeenAt.toISOString().slice(0, 13);
      const bucket = hourBuckets.get(key);
      if (bucket) {
        bucket.count += err.occurrences;
        if (err.level >= 60) bucket.fatal += err.occurrences;
        else bucket.error += err.occurrences;
      }
    }

    const trends = Array.from(hourBuckets.entries()).map(([hour, data]) => ({
      hour,
      ...data,
    }));

    res.json(trends);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get watchdog trends');
    res.status(500).json({ error: 'Failed to get trends', detail: errMsg(error) });
  }
});

// ── Test + Auto-Fix Endpoints ─────────────────────────────────────

// POST /api/admin/watchdog/test-alert — Write a fake error to PM2 logs for e2e testing
router.post('/test-alert', async (req: AuthRequest, res) => {
  try {
    const { errorType = 'Error', message, level = 50, category } = req.body;

    if (!message || typeof message !== 'string' || message.length < 10) {
      return res.status(400).json({ error: 'message required (min 10 chars)' });
    }

    const validCategories = ['database', 'auth', 'timeout', 'memory', 'validation', 'network', 'unknown'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const validLevel = level === 60 ? 60 : 50;

    // Find the error log path
    const logPaths = getLogPaths();
    const errorLogPath = logPaths.find(p => p.includes('error.log'));
    if (!errorLogPath) {
      return res.status(503).json({ error: 'PM2 error log path not found' });
    }

    const fakeLogEntry = {
      level: validLevel,
      time: Date.now(),
      msg: message,
      err: {
        name: errorType,
        message: message,
        stack: `${errorType}: ${message}\n    at testEndpoint (backend/src/routes/watchdog.ts:999:1)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      },
    };

    const logLine = JSON.stringify(fakeLogEntry) + '\n';
    await appendFile(errorLogPath, logLine, 'utf-8');

    res.json({
      success: true,
      message: 'Test error written to PM2 logs',
      expectedProcessingIn: validLevel >= 60 ? '< 5 seconds' : '< 30 seconds',
      logPath: errorLogPath,
      entry: fakeLogEntry,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to write test error');
    res.status(500).json({ error: 'Failed to write test error', detail: errMsg(error) });
  }
});

// POST /api/admin/watchdog/:id/auto-fix — Propose + apply auto-fix for a specific error
router.post('/:id/auto-fix', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const monitoredError = await prisma.monitoredError.findUnique({ where: { id } });
    if (!monitoredError) {
      return res.status(404).json({ error: 'Error not found' });
    }

    // Check if already has an active fix
    if (monitoredError.autoFixStatus && ['diagnosing', 'applying', 'testing', 'staged', 'approved'].includes(monitoredError.autoFixStatus)) {
      return res.status(409).json({
        error: `Auto-fix already in progress (status: ${monitoredError.autoFixStatus})`,
        autoFixStatus: monitoredError.autoFixStatus,
      });
    }

    // Reconstruct error group
    const group = {
      fingerprint: monitoredError.fingerprint,
      errorType: monitoredError.errorType,
      message: monitoredError.message,
      level: monitoredError.level,
      count: monitoredError.occurrences,
      category: 'unknown' as const,
      samples: monitoredError.samplePayload ? [monitoredError.samplePayload as any] : [],
      firstTime: monitoredError.firstSeenAt.toISOString(),
      lastTime: monitoredError.lastSeenAt.toISOString(),
    };

    if (!shouldAttemptAutoFix(group)) {
      return res.status(400).json({ error: 'This error type is not suitable for auto-fix (no stack trace or infrastructure issue)' });
    }

    // Update status
    await prisma.monitoredError.update({
      where: { id },
      data: { autoFixStatus: 'diagnosing' },
    });

    // Tier 1: Diagnosis
    const proposal = await proposeAutoFix(group);
    if (!proposal) {
      await prisma.monitoredError.update({
        where: { id },
        data: { autoFixStatus: 'failed', autoFixTestOutput: 'Claude could not propose a fix (budget exhausted or no actionable diagnosis)' },
      });
      return res.status(503).json({ error: 'Could not propose fix (budget exhausted or error not fixable)' });
    }

    // Don't auto-apply critical severity fixes
    if (proposal.severity === 'critical') {
      await prisma.monitoredError.update({
        where: { id },
        data: {
          autoFixStatus: 'proposed',
          autoFixProposal: proposal.proposedFix,
          autoFixAttemptedAt: new Date(),
          autoFixTestOutput: `Severity: critical — requires manual review\n\nRoot cause: ${proposal.rootCause}\nReasoning: ${proposal.reasoning}`,
        },
      });
      return res.json({
        status: 'proposed',
        proposal,
        message: 'Fix proposed but severity is critical — manual review required',
      });
    }

    // Tier 2: Apply on branch + test
    const result = await applyAutoFix(id, proposal);

    if (result.status === 'failed') {
      return res.status(400).json({
        status: 'failed',
        error: result.error,
        testOutput: result.testOutput,
      });
    }

    // Tier 3: Send approval request for FATAL errors
    if (monitoredError.level >= 60 && result.status === 'staged') {
      await sendFixApprovalTelegram(id, proposal);
    }

    res.json({
      status: result.status,
      proposal,
      branchName: result.branchName,
      testOutput: result.testOutput,
      message: monitoredError.level >= 60
        ? 'Fix staged on branch. Approval required (Telegram notification sent).'
        : 'Fix staged on branch and ready for merge.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to propose auto-fix');
    res.status(500).json({ error: 'Failed to propose auto-fix', detail: errMsg(error) });
  }
});

// POST /api/admin/watchdog/:id/approve-fix — Approve and merge a staged fix
router.post('/:id/approve-fix', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await approveAndMergeFix(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      status: 'merged',
      message: 'Fix approved, merged to master, and PM2 restarted.',
      output: result.output,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to approve fix');
    res.status(500).json({ error: 'Failed to approve fix', detail: errMsg(error) });
  }
});

// POST /api/admin/watchdog/:id/reject-fix — Reject and clean up a staged fix
router.post('/:id/reject-fix', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await rejectFix(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ status: 'rejected', message: 'Fix rejected and branch deleted.' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to reject fix');
    res.status(500).json({ error: 'Failed to reject fix', detail: errMsg(error) });
  }
});

export default router;
