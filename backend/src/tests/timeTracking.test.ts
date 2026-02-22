import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, authRequest } from './helpers.js';

vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

async function cleanTimeTrackingData() {
  await prisma.timeEntry.deleteMany();
  await prisma.staffApiKey.deleteMany();
  await prisma.human.deleteMany();
}

let adminUser: { id: string; email: string; name: string; token: string };
let staffUser: { id: string; email: string; name: string; token: string };
let regularUser: { id: string; email: string; name: string; token: string };

beforeEach(async () => {
  await cleanTimeTrackingData();

  const adminEmail = 'admin-tt@example.com';
  process.env.ADMIN_EMAILS = adminEmail;

  adminUser = await createTestUser({ email: adminEmail, name: 'Admin User' });
  staffUser = await createTestUser({ email: 'staff-tt@example.com', name: 'Staff Member' });
  regularUser = await createTestUser({ email: 'regular-tt@example.com', name: 'Regular User' });

  // Promote staff user
  await prisma.human.update({
    where: { id: staffUser.id },
    data: { role: 'STAFF' },
  });
});

describe('Time Tracking API', () => {
  // ===== ACCESS CONTROL =====
  describe('Access Control', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/time-tracking/status');
      expect(res.status).toBe(401);
    });

    it('should return 403 for regular users', async () => {
      const res = await authRequest(regularUser.token)
        .get('/api/admin/time-tracking/status');
      expect(res.status).toBe(403);
    });

    it('should allow staff users', async () => {
      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/status');
      expect(res.status).toBe(200);
    });

    it('should allow admin users', async () => {
      const res = await authRequest(adminUser.token)
        .get('/api/admin/time-tracking/status');
      expect(res.status).toBe(200);
    });

    it('should authenticate with staff API key', async () => {
      const keyBytes = crypto.randomBytes(24).toString('hex');
      const apiKey = `hp_${keyBytes}`;
      const apiKeyHash = await bcrypt.hash(apiKey, 12);

      await prisma.staffApiKey.create({
        data: {
          humanId: staffUser.id,
          apiKeyPrefix: apiKey.substring(0, 8),
          apiKeyHash,
          createdBy: adminUser.id,
        },
      });

      const res = await request(app)
        .get('/api/admin/time-tracking/status')
        .set('X-Admin-API-Key', apiKey);
      expect(res.status).toBe(200);
    });
  });

  // ===== GET /status =====
  describe('GET /api/admin/time-tracking/status', () => {
    it('should return clocked out when no open entry', async () => {
      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/status');

      expect(res.status).toBe(200);
      expect(res.body.clockedIn).toBe(false);
      expect(res.body.since).toBeNull();
      expect(res.body.entryId).toBeNull();
    });

    it('should return clocked in when open entry exists', async () => {
      const entry = await prisma.timeEntry.create({
        data: { humanId: staffUser.id },
      });

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/status');

      expect(res.status).toBe(200);
      expect(res.body.clockedIn).toBe(true);
      expect(res.body.since).toBeDefined();
      expect(res.body.entryId).toBe(entry.id);
    });
  });

  // ===== POST /clock-in =====
  describe('POST /api/admin/time-tracking/clock-in', () => {
    it('should create a new time entry', async () => {
      const res = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-in');

      expect(res.status).toBe(200);
      expect(res.body.clockedIn).toBe(true);
      expect(res.body.since).toBeDefined();
      expect(res.body.entryId).toBeDefined();

      // Verify in DB
      const entry = await prisma.timeEntry.findUnique({
        where: { id: res.body.entryId },
      });
      expect(entry).not.toBeNull();
      expect(entry!.humanId).toBe(staffUser.id);
      expect(entry!.clockOut).toBeNull();
    });

    it('should return 409 if already clocked in', async () => {
      // Clock in first
      await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-in');

      // Try again
      const res = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-in');

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Already clocked in');
      expect(res.body.since).toBeDefined();
    });

    it('should allow different users to clock in independently', async () => {
      const res1 = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-in');
      const res2 = await authRequest(adminUser.token)
        .post('/api/admin/time-tracking/clock-in');

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.entryId).not.toBe(res2.body.entryId);
    });
  });

  // ===== POST /clock-out =====
  describe('POST /api/admin/time-tracking/clock-out', () => {
    it('should close the open entry and compute duration', async () => {
      // Create an entry 30 minutes ago
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: thirtyMinAgo },
      });

      const res = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-out')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.clockedIn).toBe(false);
      expect(res.body.entry.clockOut).toBeDefined();
      expect(res.body.entry.duration).toBeGreaterThanOrEqual(29);
      expect(res.body.entry.duration).toBeLessThanOrEqual(31);
    });

    it('should save notes on clock-out', async () => {
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id },
      });

      const res = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-out')
        .send({ notes: 'Worked on posting queue' });

      expect(res.status).toBe(200);
      expect(res.body.entry.notes).toBe('Worked on posting queue');
    });

    it('should return 404 if not clocked in', async () => {
      const res = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-out')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not currently clocked in');
    });
  });

  // ===== GET /entries =====
  describe('GET /api/admin/time-tracking/entries', () => {
    it('should return paginated entries for current user', async () => {
      // Create 3 entries
      for (let i = 0; i < 3; i++) {
        await prisma.timeEntry.create({
          data: {
            humanId: staffUser.id,
            clockIn: new Date(Date.now() - (3 - i) * 3600000),
            clockOut: new Date(Date.now() - (3 - i) * 3600000 + 1800000),
            duration: 30,
          },
        });
      }

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/entries');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should paginate correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.timeEntry.create({
          data: {
            humanId: staffUser.id,
            clockIn: new Date(Date.now() - (5 - i) * 3600000),
            clockOut: new Date(Date.now() - (5 - i) * 3600000 + 1800000),
            duration: 30,
          },
        });
      }

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/entries?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it('should not show other users entries for staff', async () => {
      await prisma.timeEntry.create({
        data: { humanId: adminUser.id, clockIn: new Date(), clockOut: new Date(), duration: 10 },
      });

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/entries');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(0);
    });

    it('should allow admin to view other staff entries via humanId', async () => {
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: new Date(), clockOut: new Date(), duration: 60 },
      });

      const res = await authRequest(adminUser.token)
        .get(`/api/admin/time-tracking/entries?humanId=${staffUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].humanId).toBe(staffUser.id);
    });

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 3600000);
      const twoDaysAgo = new Date(Date.now() - 48 * 3600000);

      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: twoDaysAgo, clockOut: twoDaysAgo, duration: 30 },
      });
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: yesterday, clockOut: yesterday, duration: 60 },
      });

      const from = new Date(Date.now() - 36 * 3600000).toISOString();
      const res = await authRequest(staffUser.token)
        .get(`/api/admin/time-tracking/entries?from=${from}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].duration).toBe(60);
    });

    it('should order entries by clockIn descending', async () => {
      const older = new Date(Date.now() - 7200000);
      const newer = new Date(Date.now() - 3600000);

      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: older, clockOut: older, duration: 30 },
      });
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: newer, clockOut: newer, duration: 60 },
      });

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/entries');

      expect(res.body.entries[0].duration).toBe(60); // newer first
      expect(res.body.entries[1].duration).toBe(30);
    });
  });

  // ===== GET /summary =====
  describe('GET /api/admin/time-tracking/summary', () => {
    it('should return zeroes when no entries', async () => {
      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/summary');

      expect(res.status).toBe(200);
      expect(res.body.today.minutes).toBe(0);
      expect(res.body.week.minutes).toBe(0);
      expect(res.body.month.minutes).toBe(0);
    });

    it('should sum completed entries for today', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      await prisma.timeEntry.create({
        data: {
          humanId: staffUser.id,
          clockIn: oneHourAgo,
          clockOut: now,
          duration: 60,
        },
      });

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/summary');

      expect(res.status).toBe(200);
      expect(res.body.today.minutes).toBe(60);
      expect(res.body.today.hours).toBe(1);
    });

    it('should include partial time from open entry', async () => {
      // Clock in ~30 mins ago
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id, clockIn: thirtyMinAgo },
      });

      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/summary');

      expect(res.status).toBe(200);
      expect(res.body.today.minutes).toBeGreaterThanOrEqual(29);
      expect(res.body.today.minutes).toBeLessThanOrEqual(31);
    });

    it('should allow admin to view other staff summary', async () => {
      await prisma.timeEntry.create({
        data: {
          humanId: staffUser.id,
          clockIn: new Date(Date.now() - 3600000),
          clockOut: new Date(),
          duration: 60,
        },
      });

      const res = await authRequest(adminUser.token)
        .get(`/api/admin/time-tracking/summary?humanId=${staffUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.today.minutes).toBe(60);
    });
  });

  // ===== GET /all-staff =====
  describe('GET /api/admin/time-tracking/all-staff', () => {
    it('should return 403 for non-admin staff', async () => {
      const res = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/all-staff');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });

    it('should return all staff with clock status', async () => {
      // Promote admin in DB so they appear in the staff query
      await prisma.human.update({
        where: { id: adminUser.id },
        data: { role: 'ADMIN' },
      });

      const res = await authRequest(adminUser.token)
        .get('/api/admin/time-tracking/all-staff');

      expect(res.status).toBe(200);
      expect(res.body.staff).toBeDefined();
      expect(Array.isArray(res.body.staff)).toBe(true);

      // Should include the staff user and admin
      const staffMember = res.body.staff.find((s: any) => s.id === staffUser.id);
      const adminMember = res.body.staff.find((s: any) => s.id === adminUser.id);
      expect(staffMember).toBeDefined();
      expect(adminMember).toBeDefined();
    });

    it('should show active clock status for clocked-in staff', async () => {
      // Clock in the staff user
      await prisma.timeEntry.create({
        data: { humanId: staffUser.id },
      });

      const res = await authRequest(adminUser.token)
        .get('/api/admin/time-tracking/all-staff');

      const staffMember = res.body.staff.find((s: any) => s.id === staffUser.id);
      expect(staffMember.clockedIn).toBe(true);
      expect(staffMember.clockedInSince).toBeDefined();
    });

    it('should compute today and week hours', async () => {
      await prisma.timeEntry.create({
        data: {
          humanId: staffUser.id,
          clockIn: new Date(Date.now() - 7200000),
          clockOut: new Date(),
          duration: 120,
        },
      });

      const res = await authRequest(adminUser.token)
        .get('/api/admin/time-tracking/all-staff');

      const staffMember = res.body.staff.find((s: any) => s.id === staffUser.id);
      expect(staffMember.todayHours).toBe(2);
      expect(staffMember.weekHours).toBe(2);
    });

    it('should not include regular users', async () => {
      const res = await authRequest(adminUser.token)
        .get('/api/admin/time-tracking/all-staff');

      const regular = res.body.staff.find((s: any) => s.id === regularUser.id);
      expect(regular).toBeUndefined();
    });
  });

  // ===== FULL WORKFLOW =====
  describe('Clock in → Clock out workflow', () => {
    it('should complete a full clock cycle via API', async () => {
      // Clock in
      const clockInRes = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-in');
      expect(clockInRes.status).toBe(200);
      expect(clockInRes.body.clockedIn).toBe(true);

      // Check status
      const statusRes = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/status');
      expect(statusRes.body.clockedIn).toBe(true);

      // Clock out
      const clockOutRes = await authRequest(staffUser.token)
        .post('/api/admin/time-tracking/clock-out')
        .send({ notes: 'Done for today' });
      expect(clockOutRes.status).toBe(200);
      expect(clockOutRes.body.clockedIn).toBe(false);
      expect(clockOutRes.body.entry.notes).toBe('Done for today');
      expect(clockOutRes.body.entry.duration).toBeDefined();

      // Verify status after clock-out
      const statusRes2 = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/status');
      expect(statusRes2.body.clockedIn).toBe(false);

      // Verify entry appears in list
      const entriesRes = await authRequest(staffUser.token)
        .get('/api/admin/time-tracking/entries');
      expect(entriesRes.body.entries).toHaveLength(1);
      expect(entriesRes.body.entries[0].notes).toBe('Done for today');
    });
  });
});
