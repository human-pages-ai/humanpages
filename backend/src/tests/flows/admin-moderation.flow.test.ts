/**
 * Integration Test: Admin Moderation Flow
 *
 * Simulates admin moderation activities:
 *   1. Non-admin user gets rejected from admin endpoints
 *   2. Admin user can access dashboard stats
 *   3. Admin can list and search users
 *   4. Admin can list and filter agents
 *   5. Admin can list and filter jobs
 *   6. Admin can view activity feed
 *   7. Agent abuse reporting flow
 *   8. Auto-suspension at 3 reports
 *   9. Auto-ban at 5 reports
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  cleanDatabase,
  createTestUser,
  createActiveTestAgent,
  authRequest,
  TestUser,
  TestAgent,
} from '../helpers.js';

// Mock email module
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

// The admin email configured in test env
const ADMIN_EMAIL = process.env.ADMIN_EMAILS || 'hello@humanpages.ai';

let adminUser: TestUser;
let regularUser: TestUser;
let agent: TestAgent;

beforeEach(async () => {
  await cleanDatabase();

  // Create admin user with the admin email
  adminUser = await createTestUser({
    email: ADMIN_EMAIL.split(',')[0].trim(),
    name: 'Admin User',
    password: 'adminpass123',
  });

  // Create regular user
  regularUser = await createTestUser({
    email: 'regular@example.com',
    name: 'Regular User',
    password: 'regularpass123',
  });
  await prisma.human.update({
    where: { id: regularUser.id },
    data: {
      emailVerified: true,
      skills: ['photography'],
      isAvailable: true,
    },
  });

  // Create active agent
  agent = await createActiveTestAgent({ name: 'Moderated Agent', tier: 'BASIC' });
});

describe('Flow: Admin Moderation — Dashboard & Abuse Management', () => {

  describe('Access Control', () => {
    it('should reject non-admin user from admin endpoints', async () => {
      const statsRes = await authRequest(regularUser.token).get('/api/admin/stats');
      expect(statsRes.status).toBe(403);
      expect(statsRes.body.error).toContain('Admin access required');

      const usersRes = await authRequest(regularUser.token).get('/api/admin/users');
      expect(usersRes.status).toBe(403);

      const agentsRes = await authRequest(regularUser.token).get('/api/admin/agents');
      expect(agentsRes.status).toBe(403);
    });

    it('should reject unauthenticated access to admin endpoints', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('should confirm admin status', async () => {
      const meRes = await authRequest(adminUser.token).get('/api/admin/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.isAdmin).toBe(true);
    });
  });

  describe('Dashboard Stats', () => {
    it('should return aggregate dashboard statistics', async () => {
      const statsRes = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(statsRes.status).toBe(200);

      expect(statsRes.body.users).toBeDefined();
      expect(statsRes.body.users.total).toBeGreaterThanOrEqual(2); // admin + regular
      expect(statsRes.body.users.verified).toBeTypeOf('number');

      expect(statsRes.body.agents).toBeDefined();
      expect(statsRes.body.agents.total).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.agents.byStatus).toBeDefined();

      expect(statsRes.body.jobs).toBeDefined();
      expect(statsRes.body.jobs.total).toBeTypeOf('number');
      expect(statsRes.body.jobs.paymentVolume).toBeTypeOf('number');

      expect(statsRes.body.reports).toBeDefined();
      expect(statsRes.body.reports.total).toBeTypeOf('number');
      expect(statsRes.body.reports.pending).toBeTypeOf('number');
    });
  });

  describe('User Management', () => {
    it('should list users with pagination', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users?page=1&limit=10');
      expect(res.status).toBe(200);

      expect(res.body.users).toBeDefined();
      expect(res.body.users.length).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should search users by name', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users?search=Regular');
      expect(res.status).toBe(200);

      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.users[0].name).toBe('Regular User');
    });

    it('should filter users by email verification status', async () => {
      const verifiedRes = await authRequest(adminUser.token)
        .get('/api/admin/users?verified=true');
      expect(verifiedRes.status).toBe(200);

      const verifiedEmails = verifiedRes.body.users.map((u: any) => u.email);
      expect(verifiedEmails).toContain('regular@example.com');
    });

    it('should sort users by different fields', async () => {
      const res = await authRequest(adminUser.token)
        .get('/api/admin/users?sort=name&order=asc');
      expect(res.status).toBe(200);

      const names = res.body.users.map((u: any) => u.name);
      // Verify sorted ascending
      for (let i = 1; i < names.length; i++) {
        expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Agent Management', () => {
    it('should list agents with pagination', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/agents?page=1&limit=10');
      expect(res.status).toBe(200);

      expect(res.body.agents).toBeDefined();
      expect(res.body.agents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter agents by status', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/agents?status=ACTIVE');
      expect(res.status).toBe(200);

      res.body.agents.forEach((a: any) => {
        expect(a.status).toBe('ACTIVE');
      });
    });

    it('should search agents by name', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/agents?search=Moderated');
      expect(res.status).toBe(200);

      expect(res.body.agents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.agents[0].name).toBe('Moderated Agent');
    });
  });

  describe('Job Monitoring', () => {
    it('should list jobs with pagination', async () => {
      // Create a job
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'test-agent',
          agentName: agent.name,
          registeredAgentId: agent.id,
          title: 'Admin monitored job',
          description: 'Test',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs');
      expect(res.status).toBe(200);

      expect(res.body.jobs).toBeDefined();
      expect(res.body.jobs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.jobs[0].title).toBe('Admin monitored job');
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter jobs by status', async () => {
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'test',
          title: 'Completed Job',
          description: 'Test',
          priceUsdc: 50,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs?status=COMPLETED');
      expect(res.status).toBe(200);

      res.body.jobs.forEach((j: any) => {
        expect(j.status).toBe('COMPLETED');
      });
    });
  });

  describe('Activity Feed', () => {
    it('should show recent activity across the platform', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/activity');
      expect(res.status).toBe(200);
      expect(res.body.activity).toBeDefined();
      expect(res.body.activity).toBeInstanceOf(Array);

      // Should contain user signups and agent registrations
      const types = res.body.activity.map((a: any) => a.type);
      expect(types).toContain('user');
      expect(types).toContain('agent');
    });
  });

  describe('Agent Abuse Reporting', () => {
    it('should allow human to report an agent', async () => {
      const reportRes = await authRequest(regularUser.token)
        .post(`/api/agents/${agent.id}/report`)
        .send({
          reason: 'SPAM',
          description: 'This agent keeps sending irrelevant job offers.',
        });

      expect(reportRes.status).toBe(201);
      expect(reportRes.body.id).toBeDefined();
      expect(reportRes.body.message).toBe('Report submitted');

      // Verify abuse score incremented
      const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(updatedAgent!.abuseScore).toBe(1);
    });

    it('should auto-suspend agent at 3 reports', async () => {
      // Create 3 different reporters
      const reporters = [];
      for (let i = 0; i < 3; i++) {
        reporters.push(
          await createTestUser({ email: `reporter${i}@example.com`, name: `Reporter ${i}` })
        );
      }

      // File 3 reports
      for (const reporter of reporters) {
        const res = await authRequest(reporter.token)
          .post(`/api/agents/${agent.id}/report`)
          .send({ reason: 'SPAM', description: `Report from ${reporter.name}` });
        expect(res.status).toBe(201);
      }

      // Agent should be auto-suspended
      const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(updatedAgent!.status).toBe('SUSPENDED');
      expect(updatedAgent!.abuseStrikes).toBeGreaterThanOrEqual(1);
    });

    it('should auto-ban agent at 5 reports', async () => {
      // Create 5 reporters
      const reporters = [];
      for (let i = 0; i < 5; i++) {
        reporters.push(
          await createTestUser({ email: `banreporter${i}@example.com`, name: `BanReporter ${i}` })
        );
      }

      // File 5 reports
      for (const reporter of reporters) {
        const res = await authRequest(reporter.token)
          .post(`/api/agents/${agent.id}/report`)
          .send({ reason: 'FRAUD', description: `Report from ${reporter.name}` });
        expect(res.status).toBe(201);
      }

      // Agent should be auto-banned
      const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(updatedAgent!.status).toBe('BANNED');
    });

    it('should reject report without authentication', async () => {
      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(401);
    });

    it('should reject report with invalid reason', async () => {
      const res = await authRequest(regularUser.token)
        .post(`/api/agents/${agent.id}/report`)
        .send({ reason: 'INVALID_REASON' });

      expect(res.status).toBe(400);
    });

    it('should reject report for non-existent agent', async () => {
      const res = await authRequest(regularUser.token)
        .post('/api/agents/non-existent-id/report')
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(404);
    });
  });
});
