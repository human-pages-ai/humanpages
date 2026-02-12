import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, createTestUserWithProfile, TestUser } from './helpers.js';

describe('Human User Reporting', () => {
  let reporter: TestUser;
  let target: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    // Reporter: verified email, account created > 24h ago
    reporter = await createTestUserWithProfile(
      { emailVerified: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      { email: 'reporter@example.com', name: 'Reporter' }
    );
    // Target: verified email
    target = await createTestUserWithProfile(
      { emailVerified: true },
      { email: 'target@example.com', name: 'Target User' }
    );
  });

  describe('POST /api/humans/:id/report', () => {
    it('should create a report successfully', async () => {
      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({
          reason: 'SPAM',
          description: 'This user has a fake profile',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toBe('Report submitted');

      // Verify report in DB
      const report = await prisma.humanReport.findFirst({
        where: { reportedHumanId: target.id, reporterHumanId: reporter.id },
      });
      expect(report).not.toBeNull();
      expect(report?.reason).toBe('SPAM');
      expect(report?.description).toBe('This user has a fake profile');
      expect(report?.status).toBe('PENDING');
    });

    it('should reject report without authentication', async () => {
      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(401);
    });

    it('should reject report from unverified email', async () => {
      const unverified = await createTestUserWithProfile(
        { emailVerified: false, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        { email: 'unverified@example.com', name: 'Unverified' }
      );

      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${unverified.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(403);
    });

    it('should reject self-report', async () => {
      const res = await request(app)
        .post(`/api/humans/${reporter.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cannot report yourself');
    });

    it('should reject invalid reason', async () => {
      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'INVALID_REASON' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/humans/nonexistent-id/report')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(404);
    });

    it('should reject report from account less than 24 hours old', async () => {
      const newUser = await createTestUserWithProfile(
        { emailVerified: true }, // createdAt defaults to now (< 24h old)
        { email: 'newuser@example.com', name: 'New User' }
      );

      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${newUser.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('24 hours');
    });

    it('should reject report when lifetime cap (10) is reached', async () => {
      // Create 10 different targets and report each one
      for (let i = 0; i < 10; i++) {
        const t = await createTestUserWithProfile(
          { emailVerified: true },
          { email: `target-${i}@example.com`, name: `Target ${i}` }
        );
        await request(app)
          .post(`/api/humans/${t.id}/report`)
          .set('Authorization', `Bearer ${reporter.token}`)
          .send({ reason: 'SPAM' });
      }

      // 11th report should be rejected
      const extraTarget = await createTestUserWithProfile(
        { emailVerified: true },
        { email: 'extra-target@example.com', name: 'Extra Target' }
      );
      const res = await request(app)
        .post(`/api/humans/${extraTarget.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('lifetime');
    });

    it('should reject duplicate pending report for same target', async () => {
      // First report
      await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'SPAM' });

      // Second report for same target
      const res = await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'FRAUD' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('pending report');
    });

    it('should increment abuseScore on report', async () => {
      await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ reason: 'SPAM' });

      const dbHuman = await prisma.human.findUnique({ where: { id: target.id } });
      expect(dbHuman?.abuseScore).toBe(1);
    });
  });

  describe('Auto-suspension and ban thresholds', () => {
    it('should auto-suspend user after 3 non-dismissed reports', async () => {
      const reporters = await Promise.all(
        [1, 2, 3].map((i) =>
          createTestUserWithProfile(
            { emailVerified: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            { email: `sus-reporter-${i}@example.com`, name: `Reporter ${i}` }
          )
        )
      );

      for (const r of reporters) {
        await request(app)
          .post(`/api/humans/${target.id}/report`)
          .set('Authorization', `Bearer ${r.token}`)
          .send({ reason: 'SPAM' });
      }

      const dbHuman = await prisma.human.findUnique({ where: { id: target.id } });
      expect(dbHuman?.humanStatus).toBe('SUSPENDED');
      expect(dbHuman?.abuseStrikes).toBeGreaterThanOrEqual(1);
    });

    it('should auto-ban user after 5 non-dismissed reports', async () => {
      const reporters = await Promise.all(
        [1, 2, 3, 4, 5].map((i) =>
          createTestUserWithProfile(
            { emailVerified: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            { email: `ban-reporter-${i}@example.com`, name: `Ban Reporter ${i}` }
          )
        )
      );

      for (const r of reporters) {
        await request(app)
          .post(`/api/humans/${target.id}/report`)
          .set('Authorization', `Bearer ${r.token}`)
          .send({ reason: 'FRAUD' });
      }

      const dbHuman = await prisma.human.findUnique({ where: { id: target.id } });
      expect(dbHuman?.humanStatus).toBe('BANNED');
    });

    it('should NOT auto-suspend if reports are dismissed', async () => {
      const reporters = await Promise.all(
        [1, 2, 3].map((i) =>
          createTestUserWithProfile(
            { emailVerified: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            { email: `dis-reporter-${i}@example.com`, name: `Dis Reporter ${i}` }
          )
        )
      );

      // Submit first two reports
      for (const r of reporters.slice(0, 2)) {
        await request(app)
          .post(`/api/humans/${target.id}/report`)
          .set('Authorization', `Bearer ${r.token}`)
          .send({ reason: 'SPAM' });
      }

      // Dismiss the two reports
      await prisma.humanReport.updateMany({
        where: { reportedHumanId: target.id },
        data: { status: 'DISMISSED' },
      });

      // Third report — now only 1 non-dismissed
      await request(app)
        .post(`/api/humans/${target.id}/report`)
        .set('Authorization', `Bearer ${reporters[2].token}`)
        .send({ reason: 'SPAM' });

      const dbHuman = await prisma.human.findUnique({ where: { id: target.id } });
      expect(dbHuman?.humanStatus).toBe('ACTIVE');
    });
  });

  describe('Banned/suspended users hidden from public', () => {
    it('should hide suspended user from public profile', async () => {
      // Suspend the target
      await prisma.human.update({
        where: { id: target.id },
        data: { humanStatus: 'SUSPENDED' },
      });

      const res = await request(app).get(`/api/humans/${target.id}`);
      expect(res.status).toBe(404);
    });

    it('should hide banned user from username lookup', async () => {
      await prisma.human.update({
        where: { id: target.id },
        data: { humanStatus: 'BANNED', username: 'banned-user' },
      });

      const res = await request(app).get('/api/humans/u/banned-user');
      expect(res.status).toBe(404);
    });
  });
});
