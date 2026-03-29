import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, authRequest } from './helpers.js';

// Mock email module
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

async function cleanTestData() {
  await prisma.certificate.deleteMany();
  await prisma.education.deleteMany();
  await prisma.agentReport.deleteMany();
  await prisma.humanReport.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.review.deleteMany();
  await prisma.jobMessage.deleteMany();
  await prisma.job.deleteMany();
  await prisma.listingApplication.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.vouch.deleteMany();
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.human.deleteMany();
}

let adminUser: { id: string; email: string; name: string; token: string };

beforeEach(async () => {
  await cleanTestData();
  const adminEmail = 'admin-analytics@example.com';
  process.env.ADMIN_EMAILS = adminEmail;
  adminUser = await createTestUser({ email: adminEmail, name: 'Analytics Admin' });
});

describe('Admin Analytics — Growth Dashboard', () => {

  describe('GET /api/admin/stats — usage analytics fields', () => {

    it('should return the new analytics series in usage', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('usage');

      const { usage } = res.body;
      // Core metrics
      expect(usage).toHaveProperty('dau');
      expect(usage).toHaveProperty('wau');
      expect(usage).toHaveProperty('mau');
      expect(usage).toHaveProperty('dauWauRatio');
      expect(usage).toHaveProperty('retentionRate');

      // Daily series
      expect(usage).toHaveProperty('signupsByDay');
      expect(usage).toHaveProperty('activeByDay');
      expect(usage).toHaveProperty('cryptoSignupsByDay');
      expect(usage).toHaveProperty('cvSignupsByDay');
      expect(usage).toHaveProperty('verifiedSignupsByDay');
      expect(usage).toHaveProperty('cumulativeSignups');
      expect(usage).toHaveProperty('jobsByDay');
      expect(usage).toHaveProperty('paidJobsByDay');
      expect(usage).toHaveProperty('paymentVolumeByDay');
      expect(usage).toHaveProperty('applicationsByDay');
      expect(usage).toHaveProperty('agentsByDay');
    });

    it('should return arrays of {day, count} for all daily series', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      const series = [
        'signupsByDay', 'activeByDay', 'cryptoSignupsByDay', 'cvSignupsByDay',
        'verifiedSignupsByDay', 'cumulativeSignups', 'jobsByDay', 'paidJobsByDay',
        'paymentVolumeByDay', 'applicationsByDay', 'agentsByDay',
      ];

      for (const key of series) {
        expect(Array.isArray(res.body.usage[key])).toBe(true);
        // Should cover 90 days
        expect(res.body.usage[key].length).toBe(90);
        // Each entry should have day and count
        const first = res.body.usage[key][0];
        expect(first).toHaveProperty('day');
        expect(first).toHaveProperty('count');
        expect(typeof first.day).toBe('string');
        expect(typeof first.count).toBe('number');
      }
    });

    it('should count a verified user in verifiedSignupsByDay', async () => {
      // Create a verified user (today)
      const verifiedUser = await createTestUser({ email: 'verified@example.com', name: 'Verified' });
      await prisma.human.update({
        where: { id: verifiedUser.id },
        data: { emailVerified: true },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      const todayStr = new Date().toISOString().split('T')[0];
      const todayEntry = res.body.usage.verifiedSignupsByDay.find(
        (e: { day: string }) => e.day === todayStr
      );

      // Admin user is also verified by default, so at least 1
      expect(todayEntry).toBeDefined();
      expect(todayEntry.count).toBeGreaterThanOrEqual(1);
    });

    it('should count user with wallet in cryptoSignupsByDay', async () => {
      const cryptoUser = await createTestUser({ email: 'crypto@example.com', name: 'Crypto User' });
      await prisma.wallet.create({
        data: {
          humanId: cryptoUser.id,
          address: '0x' + 'a'.repeat(40),
          chain: 'ETHEREUM',
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      const todayStr = new Date().toISOString().split('T')[0];
      const todayEntry = res.body.usage.cryptoSignupsByDay.find(
        (e: { day: string }) => e.day === todayStr
      );

      expect(todayEntry).toBeDefined();
      expect(todayEntry.count).toBeGreaterThanOrEqual(1);
    });

    it('should have monotonically non-decreasing cumulative signups', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const cumulative = res.body.usage.cumulativeSignups;

      for (let i = 1; i < cumulative.length; i++) {
        expect(cumulative[i].count).toBeGreaterThanOrEqual(cumulative[i - 1].count);
      }
    });
  });

  describe('GET /api/admin/stats — non-admin blocked', () => {
    it('should return 403 for non-admin user', async () => {
      const normalUser = await createTestUser({ email: 'normal@example.com', name: 'Normal' });
      const res = await authRequest(normalUser.token).get('/api/admin/stats');
      expect(res.status).toBe(403);
    });
  });
});

describe('Admin Analytics — Funnel Endpoint', () => {

  describe('GET /api/admin/stats/funnel', () => {

    it('should return 200 with all expected sections', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('funnel');
      expect(res.body).toHaveProperty('sourceQuality');
      expect(res.body).toHaveProperty('signupMethodsByDay');
      expect(res.body).toHaveProperty('abandonment');
      expect(res.body).toHaveProperty('velocity');
      expect(res.body).toHaveProperty('cohortFunnel');
    });

    it('should return funnel stages as a record of numbers', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      const { funnel } = res.body;
      expect(typeof funnel).toBe('object');
      // Should have at least total_signups
      expect(funnel).toHaveProperty('total_signups');
      expect(typeof funnel.total_signups).toBe('number');
    });

    it('should return sourceQuality as an array of source objects', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      expect(Array.isArray(res.body.sourceQuality)).toBe(true);
      // May be empty if no UTM data, but should be an array
    });

    it('should return signupMethodsByDay as array with daily breakdown', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      expect(Array.isArray(res.body.signupMethodsByDay)).toBe(true);
      if (res.body.signupMethodsByDay.length > 0) {
        const entry = res.body.signupMethodsByDay[0];
        expect(entry).toHaveProperty('day');
        expect(entry).toHaveProperty('email');
        expect(entry).toHaveProperty('google');
        expect(entry).toHaveProperty('linkedin');
        expect(entry).toHaveProperty('whatsapp');
      }
    });

    it('should return abandonment as array of stage objects', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      expect(Array.isArray(res.body.abandonment)).toBe(true);
      if (res.body.abandonment.length > 0) {
        const entry = res.body.abandonment[0];
        expect(entry).toHaveProperty('stage');
        expect(entry).toHaveProperty('count');
        expect(entry).toHaveProperty('avg_completeness');
        expect(entry).toHaveProperty('avg_days_inactive');
      }
    });

    it('should return velocity metrics', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      const { velocity } = res.body;
      expect(velocity).toHaveProperty('avgCompletenessAll');
      expect(velocity).toHaveProperty('avgCompleteness7d');
      expect(velocity).toHaveProperty('avgCompleteness30d');
    });

    it('should return cohortFunnel as array of weekly cohorts', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      expect(Array.isArray(res.body.cohortFunnel)).toBe(true);
      if (res.body.cohortFunnel.length > 0) {
        const entry = res.body.cohortFunnel[0];
        expect(entry).toHaveProperty('week');
        expect(entry).toHaveProperty('signups');
        expect(entry).toHaveProperty('verified');
      }
    });

    it('should count the admin user in funnel total_signups', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');

      // At minimum, the admin user we created exists
      expect(res.body.funnel.total_signups).toBeGreaterThanOrEqual(1);
    });

    it('should reflect new verified users in funnel', async () => {
      // Create 3 additional verified users
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser({ email: `funnel-v${i}@example.com`, name: `FunnelV ${i}` });
        await prisma.human.update({
          where: { id: u.id },
          data: { emailVerified: true },
        });
      }

      const res = await authRequest(adminUser.token).get('/api/admin/stats/funnel');
      expect(res.body.funnel.email_verified).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/admin/stats/funnel — non-admin blocked', () => {
    it('should return 403 for non-admin user', async () => {
      const normalUser = await createTestUser({ email: 'normal-funnel@example.com', name: 'Normal' });
      const res = await authRequest(normalUser.token).get('/api/admin/stats/funnel');
      expect(res.status).toBe(403);
    });
  });
});
