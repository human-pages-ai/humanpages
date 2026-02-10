import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, createActiveTestAgent, authRequest } from './helpers.js';

// Mock email module
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

// Local cleanup that only touches tables this test uses (avoids pre-existing AffiliatePayout issue)
async function cleanAdminTestData() {
  await prisma.agentReport.deleteMany();
  await prisma.review.deleteMany();
  await prisma.jobMessage.deleteMany();
  await prisma.job.deleteMany();
  await prisma.vouch.deleteMany();
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.human.deleteMany();
}

let adminUser: { id: string; email: string; name: string; token: string };
let regularUser: { id: string; email: string; name: string; token: string };

beforeEach(async () => {
  await cleanAdminTestData();

  // Create admin user with email matching ADMIN_EMAILS env var
  const adminEmail = 'admin-test@example.com';
  process.env.ADMIN_EMAILS = adminEmail;

  adminUser = await createTestUser({ email: adminEmail, name: 'Admin User' });
  regularUser = await createTestUser({ email: 'regular@example.com', name: 'Regular User' });
});

describe('Admin API', () => {
  // ===== AUTH / ACCESS CONTROL =====
  describe('Access Control', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/me');
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await authRequest(regularUser.token).get('/api/admin/me');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });

    it('should return 200 with isAdmin for admin users', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/me');
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(true);
    });

    it('should support comma-separated admin emails', async () => {
      process.env.ADMIN_EMAILS = `other@example.com, ${adminUser.email}, another@example.com`;

      const res = await authRequest(adminUser.token).get('/api/admin/me');
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(true);
    });

    it('should be case-insensitive for admin email matching', async () => {
      process.env.ADMIN_EMAILS = adminUser.email.toUpperCase();

      const res = await authRequest(adminUser.token).get('/api/admin/me');
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(true);
    });
  });

  // ===== GET /api/admin/stats =====
  describe('GET /api/admin/stats', () => {
    it('should return aggregate stats', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('jobs');
      expect(res.body).toHaveProperty('reports');
      expect(res.body).toHaveProperty('affiliates');
    });

    it('should return correct user counts', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      // We created 2 users in beforeEach
      expect(res.body.users.total).toBe(2);
      // In test mode, users are auto-verified
      expect(res.body.users.verified).toBe(2);
      expect(res.body.users.last7d).toBe(2);
      expect(res.body.users.last30d).toBe(2);
    });

    it('should return agent counts by status', async () => {
      await createActiveTestAgent({ status: 'ACTIVE' });
      await createActiveTestAgent({ status: 'PENDING' });
      await createActiveTestAgent({ status: 'SUSPENDED' });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      expect(res.body.agents.total).toBe(3);
      expect(res.body.agents.byStatus.ACTIVE).toBe(1);
      expect(res.body.agents.byStatus.PENDING).toBe(1);
      expect(res.body.agents.byStatus.SUSPENDED).toBe(1);
    });

    it('should return job counts and payment volume', async () => {
      const agent = await createActiveTestAgent();

      // Create a paid job
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-agent-1',
          registeredAgentId: agent.id,
          title: 'Test Job',
          description: 'A test job',
          priceUsdc: 100,
          status: 'PAID',
          paymentAmount: 100,
          paymentNetwork: 'base',
          paidAt: new Date(),
        },
      });

      // Create a pending job
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-agent-2',
          title: 'Pending Job',
          description: 'A pending job',
          priceUsdc: 50,
          status: 'PENDING',
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      expect(res.body.jobs.total).toBe(2);
      expect(res.body.jobs.byStatus.PAID).toBe(1);
      expect(res.body.jobs.byStatus.PENDING).toBe(1);
      expect(res.body.jobs.paymentVolume).toBe(100);
    });

    it('should return 403 for non-admin', async () => {
      const res = await authRequest(regularUser.token).get('/api/admin/stats');
      expect(res.status).toBe(403);
    });
  });

  // ===== GET /api/admin/users =====
  describe('GET /api/admin/users', () => {
    it('should return paginated users list', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.users).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should not include sensitive fields', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users');

      const user = res.body.users[0];
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('tokenInvalidatedAt');
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('emailVerified');
      expect(user).toHaveProperty('_count');
    });

    it('should search by name', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users?search=Admin');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].name).toBe('Admin User');
    });

    it('should search by email', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users?search=regular@');

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].email).toBe('regular@example.com');
    });

    it('should filter by verified status', async () => {
      await prisma.human.update({
        where: { id: regularUser.id },
        data: { emailVerified: false },
      });

      const verifiedRes = await authRequest(adminUser.token).get('/api/admin/users?verified=true');
      expect(verifiedRes.body.users).toHaveLength(1);
      expect(verifiedRes.body.users[0].emailVerified).toBe(true);

      const unverifiedRes = await authRequest(adminUser.token).get('/api/admin/users?verified=false');
      expect(unverifiedRes.body.users).toHaveLength(1);
      expect(unverifiedRes.body.users[0].emailVerified).toBe(false);
    });

    it('should paginate correctly', async () => {
      // Create more users to test pagination
      for (let i = 0; i < 5; i++) {
        await createTestUser({ email: `page-test-${i}@example.com`, name: `Page User ${i}` });
      }

      const page1 = await authRequest(adminUser.token).get('/api/admin/users?page=1&limit=3');
      expect(page1.body.users).toHaveLength(3);
      expect(page1.body.pagination.totalPages).toBe(3);

      const page2 = await authRequest(adminUser.token).get('/api/admin/users?page=2&limit=3');
      expect(page2.body.users).toHaveLength(3);

      const page3 = await authRequest(adminUser.token).get('/api/admin/users?page=3&limit=3');
      expect(page3.body.users).toHaveLength(1);
    });

    it('should sort by different fields', async () => {
      const ascRes = await authRequest(adminUser.token).get('/api/admin/users?sort=name&order=asc');
      expect(ascRes.status).toBe(200);
      const names = ascRes.body.users.map((u: any) => u.name);
      expect(names).toEqual([...names].sort());
    });

    it('should include _count for jobs, reviews, services', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/users');

      const user = res.body.users[0];
      expect(user._count).toHaveProperty('jobs');
      expect(user._count).toHaveProperty('reviews');
      expect(user._count).toHaveProperty('services');
    });
  });

  // ===== GET /api/admin/agents =====
  describe('GET /api/admin/agents', () => {
    it('should return paginated agents list', async () => {
      await createActiveTestAgent({ status: 'ACTIVE', name: 'Agent Alpha' });
      await createActiveTestAgent({ status: 'PENDING', name: 'Agent Beta' });

      const res = await authRequest(adminUser.token).get('/api/admin/agents');

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should not include apiKeyHash', async () => {
      await createActiveTestAgent();

      const res = await authRequest(adminUser.token).get('/api/admin/agents');
      const agent = res.body.agents[0];

      expect(agent).not.toHaveProperty('apiKeyHash');
      expect(agent).not.toHaveProperty('apiKeyPrefix');
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('status');
    });

    it('should filter by status', async () => {
      await createActiveTestAgent({ status: 'ACTIVE', name: 'Active Agent' });
      await createActiveTestAgent({ status: 'BANNED', name: 'Banned Agent' });

      const res = await authRequest(adminUser.token).get('/api/admin/agents?status=ACTIVE');
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].status).toBe('ACTIVE');
    });

    it('should search by name', async () => {
      await createActiveTestAgent({ name: 'SearchableBot' });
      await createActiveTestAgent({ name: 'OtherBot' });

      const res = await authRequest(adminUser.token).get('/api/admin/agents?search=Searchable');
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].name).toBe('SearchableBot');
    });

    it('should include _count for jobs and reports', async () => {
      await createActiveTestAgent();

      const res = await authRequest(adminUser.token).get('/api/admin/agents');
      const agent = res.body.agents[0];

      expect(agent._count).toHaveProperty('jobs');
      expect(agent._count).toHaveProperty('reports');
    });
  });

  // ===== GET /api/admin/jobs =====
  describe('GET /api/admin/jobs', () => {
    it('should return paginated jobs list', async () => {
      const agent = await createActiveTestAgent();

      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-1',
          registeredAgentId: agent.id,
          title: 'Job Alpha',
          description: 'First job',
          priceUsdc: 50,
          status: 'PENDING',
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs');

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should include human and agent info', async () => {
      const agent = await createActiveTestAgent();

      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-1',
          registeredAgentId: agent.id,
          agentName: 'TestAgentDisplay',
          title: 'Job With Relations',
          description: 'Has human and agent',
          priceUsdc: 100,
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs');
      const job = res.body.jobs[0];

      expect(job.human).toHaveProperty('id');
      expect(job.human).toHaveProperty('name');
      expect(job.human.name).toBe('Regular User');
      expect(job.registeredAgent).toHaveProperty('id');
      expect(job.registeredAgent).toHaveProperty('name');
      expect(job.agentName).toBe('TestAgentDisplay');
    });

    it('should filter by status', async () => {
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-1',
          title: 'Paid Job',
          description: 'desc',
          priceUsdc: 50,
          status: 'PAID',
          paymentAmount: 50,
          paidAt: new Date(),
        },
      });
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-2',
          title: 'Pending Job',
          description: 'desc',
          priceUsdc: 30,
          status: 'PENDING',
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs?status=PAID');
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].status).toBe('PAID');
    });

    it('should search by title', async () => {
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-1',
          title: 'Unique Banana Task',
          description: 'desc',
          priceUsdc: 25,
        },
      });
      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-2',
          title: 'Normal Task',
          description: 'desc',
          priceUsdc: 15,
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/jobs?search=Banana');
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe('Unique Banana Task');
    });
  });

  // ===== GET /api/admin/activity =====
  describe('GET /api/admin/activity', () => {
    it('should return merged activity feed', async () => {
      await createActiveTestAgent({ name: 'Activity Agent' });

      await prisma.job.create({
        data: {
          humanId: regularUser.id,
          agentId: 'ext-1',
          title: 'Activity Job',
          description: 'desc',
          priceUsdc: 10,
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/activity');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activity');
      expect(Array.isArray(res.body.activity)).toBe(true);

      const types = res.body.activity.map((a: any) => a.type);
      expect(types).toContain('user');
      expect(types).toContain('agent');
      expect(types).toContain('job');
    });

    it('should sort activity by timestamp descending', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/activity');

      const timestamps = res.body.activity.map((a: any) => new Date(a.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it('should respect limit parameter', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/activity?limit=1');

      expect(res.body.activity.length).toBeLessThanOrEqual(1);
    });

    it('should include type, id, description, timestamp fields', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/activity');

      if (res.body.activity.length > 0) {
        const item = res.body.activity[0];
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('timestamp');
        expect(['user', 'agent', 'job']).toContain(item.type);
      }
    });

    it('should return 403 for non-admin', async () => {
      const res = await authRequest(regularUser.token).get('/api/admin/activity');
      expect(res.status).toBe(403);
    });
  });
});
