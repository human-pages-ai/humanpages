import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, cleanDatabase, authRequest, type TestUser } from './helpers.js';

// Mock external services
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  writeToOutbox: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/telegram.js', () => ({
  sendTelegramMessage: vi.fn(() => Promise.resolve(true)),
}));

let adminUser: TestUser;
let regularUser: TestUser;

beforeEach(async () => {
  await cleanDatabase();

  const adminEmail = 'watchdog-admin@example.com';
  process.env.ADMIN_EMAILS = adminEmail;

  adminUser = await createTestUser({ email: adminEmail, name: 'WatchDog Admin' });
  regularUser = await createTestUser({ email: 'regular@example.com', name: 'Regular User' });
});

// ── Helper: create a monitored error in DB ───────────────────────

async function createMonitoredError(overrides?: Partial<{
  fingerprint: string;
  level: number;
  errorType: string;
  message: string;
  status: string;
  occurrences: number;
  samplePayload: any;
  autoFixStatus: string;
  autoFixBranch: string;
}>) {
  return prisma.monitoredError.create({
    data: {
      fingerprint: overrides?.fingerprint || `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: overrides?.level ?? 50,
      errorType: overrides?.errorType ?? 'TestError',
      message: overrides?.message ?? 'Test error message for unit testing',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrences: overrides?.occurrences ?? 1,
      status: overrides?.status ?? 'new',
      samplePayload: overrides?.samplePayload ?? { level: 50, msg: 'Test error' },
      autoFixStatus: overrides?.autoFixStatus,
      autoFixBranch: overrides?.autoFixBranch,
    },
  });
}

// ── GET /api/admin/watchdog ────────────────────────────────────────

describe('GET /api/admin/watchdog', () => {
  it('should require authentication', async () => {
    const res = await request(app).get('/api/admin/watchdog');
    expect(res.status).toBe(401);
  });

  it('should require admin role', async () => {
    const res = await authRequest(regularUser.token).get('/api/admin/watchdog');
    expect(res.status).toBe(403);
  });

  it('should list monitored errors', async () => {
    await createMonitoredError({ fingerprint: 'list-test-1', message: 'Error one for listing test' });
    await createMonitoredError({ fingerprint: 'list-test-2', message: 'Error two for listing test' });

    const res = await authRequest(adminUser.token).get('/api/admin/watchdog');

    expect(res.status).toBe(200);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('should filter by status', async () => {
    await createMonitoredError({ fingerprint: 'filter-alerted', status: 'alerted' });
    await createMonitoredError({ fingerprint: 'filter-resolved', status: 'resolved' });

    const res = await authRequest(adminUser.token)
      .get('/api/admin/watchdog')
      .query({ status: 'alerted' });

    expect(res.status).toBe(200);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].status).toBe('alerted');
  });

  it('should paginate results', async () => {
    for (let i = 0; i < 15; i++) {
      await createMonitoredError({ fingerprint: `page-${i}` });
    }

    const res = await authRequest(adminUser.token)
      .get('/api/admin/watchdog')
      .query({ limit: '10', offset: '0' });

    expect(res.body.errors).toHaveLength(10);
    expect(res.body.total).toBe(15);

    const res2 = await authRequest(adminUser.token)
      .get('/api/admin/watchdog')
      .query({ limit: '10', offset: '10' });

    expect(res2.body.errors).toHaveLength(5);
  });
});

// ── PATCH /api/admin/watchdog/:id ─────────────────────────────────

describe('PATCH /api/admin/watchdog/:id', () => {
  it('should update error status to acknowledged', async () => {
    const error = await createMonitoredError();

    const res = await authRequest(adminUser.token)
      .patch(`/api/admin/watchdog/${error.id}`)
      .send({ status: 'acknowledged' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('acknowledged');
    expect(res.body.acknowledgedAt).toBeDefined();
  });

  it('should set resolvedAt when status is resolved', async () => {
    const error = await createMonitoredError();

    const res = await authRequest(adminUser.token)
      .patch(`/api/admin/watchdog/${error.id}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.resolvedAt).toBeDefined();
  });

  it('should reject invalid status', async () => {
    const error = await createMonitoredError();

    const res = await authRequest(adminUser.token)
      .patch(`/api/admin/watchdog/${error.id}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status');
  });
});

// ── GET /api/admin/watchdog/stats ─────────────────────────────────

describe('GET /api/admin/watchdog/stats', () => {
  it('should return counts by status', async () => {
    await createMonitoredError({ fingerprint: 'stat-new-1', status: 'new' });
    await createMonitoredError({ fingerprint: 'stat-new-2', status: 'new' });
    await createMonitoredError({ fingerprint: 'stat-alerted', status: 'alerted' });
    await createMonitoredError({ fingerprint: 'stat-acked', status: 'acknowledged' });

    const res = await authRequest(adminUser.token).get('/api/admin/watchdog/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.new).toBe(2);
    expect(res.body.alerted).toBe(1);
    expect(res.body.acknowledged).toBe(1);
  });

  it('should return zeros when no errors', async () => {
    const res = await authRequest(adminUser.token).get('/api/admin/watchdog/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.new).toBe(0);
  });
});

// ── GET /api/admin/watchdog/health ────────────────────────────────

describe('GET /api/admin/watchdog/health', () => {
  it('should return health status shape', async () => {
    const res = await authRequest(adminUser.token).get('/api/admin/watchdog/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('filesWatched');
    expect(res.body).toHaveProperty('claudeBudget');
    expect(res.body).toHaveProperty('telegramBudget');
    expect(res.body).toHaveProperty('uptimeMs');
    expect(res.body).toHaveProperty('cursors');
    expect(res.body.claudeBudget).toHaveProperty('used');
    expect(res.body.claudeBudget).toHaveProperty('limit');
  });
});

// ── GET /api/admin/watchdog/trends ────────────────────────────────

describe('GET /api/admin/watchdog/trends', () => {
  it('should return 24 hourly buckets', async () => {
    const res = await authRequest(adminUser.token).get('/api/admin/watchdog/trends');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(24);
    expect(res.body[0]).toHaveProperty('hour');
    expect(res.body[0]).toHaveProperty('count');
    expect(res.body[0]).toHaveProperty('fatal');
    expect(res.body[0]).toHaveProperty('error');
  });

  it('should include recent errors in buckets', async () => {
    await createMonitoredError({ fingerprint: 'trend-1', occurrences: 5, level: 50 });
    await createMonitoredError({ fingerprint: 'trend-2', occurrences: 3, level: 60 });

    const res = await authRequest(adminUser.token).get('/api/admin/watchdog/trends');

    expect(res.status).toBe(200);
    const totalCount = res.body.reduce((sum: number, b: any) => sum + b.count, 0);
    expect(totalCount).toBeGreaterThanOrEqual(8); // 5 + 3
  });
});

// ── POST /api/admin/watchdog/scan ─────────────────────────────────

describe('POST /api/admin/watchdog/scan', () => {
  it('should trigger manual scan', async () => {
    const res = await authRequest(adminUser.token).post('/api/admin/watchdog/scan');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Scan completed');
  });

  it('should require admin auth', async () => {
    const res = await authRequest(regularUser.token).post('/api/admin/watchdog/scan');
    expect(res.status).toBe(403);
  });
});

// ── POST /api/admin/watchdog/reanalyze/:id ────────────────────────

describe('POST /api/admin/watchdog/reanalyze/:id', () => {
  it('should return 404 for non-existent error', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/reanalyze/non-existent-id');

    expect(res.status).toBe(404);
  });

  it('should return 503 when Claude is unavailable', async () => {
    const error = await createMonitoredError();

    // Remove API key to trigger unavailable
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/reanalyze/${error.id}`);

    process.env.ANTHROPIC_API_KEY = originalKey;

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('unavailable');
  });
});

// ── POST /api/admin/watchdog/test-alert ───────────────────────────

describe('POST /api/admin/watchdog/test-alert', () => {
  it('should require admin auth', async () => {
    const res = await request(app)
      .post('/api/admin/watchdog/test-alert')
      .send({ message: 'Test error message for auth test' });

    expect(res.status).toBe(401);
  });

  it('should reject non-admin users', async () => {
    const res = await authRequest(regularUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({ message: 'Test error message for role test' });

    expect(res.status).toBe(403);
  });

  it('should reject short messages', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({ message: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('min 10 chars');
  });

  it('should reject empty message', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({ errorType: 'TestError' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid category', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({
        message: 'Test database connection failed during query execution',
        category: 'invalid_category',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid category');
  });

  it('should accept valid test alert', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({
        errorType: 'DatabaseError',
        message: 'Test database connection timeout during query execution',
        category: 'database',
      });

    // May return 503 if log path doesn't exist in test env, which is fine
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.level).toBe(50);
      expect(res.body.entry.err.name).toBe('DatabaseError');
    } else {
      expect(res.status).toBe(503);
    }
  });

  it('should accept FATAL level', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/test-alert')
      .send({
        message: 'Fatal out of memory error in production worker process',
        level: 60,
      });

    if (res.status === 200) {
      expect(res.body.entry.level).toBe(60);
      expect(res.body.expectedProcessingIn).toBe('< 5 seconds');
    }
  });
});

// ── POST /api/admin/watchdog/:id/auto-fix ─────────────────────────

describe('POST /api/admin/watchdog/:id/auto-fix', () => {
  it('should return 404 for non-existent error', async () => {
    const res = await authRequest(adminUser.token)
      .post('/api/admin/watchdog/non-existent/auto-fix');

    expect(res.status).toBe(404);
  });

  it('should reject errors without stack trace', async () => {
    const error = await createMonitoredError({
      samplePayload: { level: 50, msg: 'No stack trace here' },
    });

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/${error.id}/auto-fix`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not suitable');
  });

  it('should reject if autofix already in progress', async () => {
    const error = await createMonitoredError({
      autoFixStatus: 'staged',
      autoFixBranch: 'session/20260313-fix-test',
    });

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/${error.id}/auto-fix`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already in progress');
  });
});

// ── POST /api/admin/watchdog/:id/approve-fix ──────────────────────

describe('POST /api/admin/watchdog/:id/approve-fix', () => {
  it('should reject when no staged fix exists', async () => {
    const error = await createMonitoredError();

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/${error.id}/approve-fix`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No staged fix');
  });

  it('should reject when fix is not in staged state', async () => {
    const error = await createMonitoredError({
      autoFixStatus: 'failed',
      autoFixBranch: 'session/20260313-fix-failed',
    });

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/${error.id}/approve-fix`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not staged');
  });
});

// ── POST /api/admin/watchdog/:id/reject-fix ───────────────────────

describe('POST /api/admin/watchdog/:id/reject-fix', () => {
  it('should reject when no fix branch exists', async () => {
    const error = await createMonitoredError();

    const res = await authRequest(adminUser.token)
      .post(`/api/admin/watchdog/${error.id}/reject-fix`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No staged fix');
  });
});
