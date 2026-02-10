import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, createTestAgent, createActiveTestAgent, createTestUserWithProfile } from './helpers.js';

describe('Agent Identity & Reputation', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/agents/register', () => {
    it('should register an agent and return API key starting with hp_', async () => {
      const res = await request(app)
        .post('/api/agents/register')
        .send({ name: 'Acme AI' });

      expect(res.status).toBe(201);
      expect(res.body.agent.name).toBe('Acme AI');
      expect(res.body.agent.id).toBeDefined();
      expect(res.body.apiKey).toMatch(/^hp_/);
      expect(res.body.apiKey.length).toBe(51); // hp_ + 48 hex chars
      expect(res.body.verificationToken).toBeDefined();
      expect(res.body.verificationToken.length).toBe(64); // 32 bytes hex
    });

    it('should register with all optional fields', async () => {
      const res = await request(app)
        .post('/api/agents/register')
        .send({
          name: 'Full Agent',
          description: 'A test agent with all fields',
          websiteUrl: 'https://example.com',
          contactEmail: 'agent@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.agent.description).toBe('A test agent with all fields');
      expect(res.body.agent.websiteUrl).toBe('https://example.com');
      expect(res.body.agent.contactEmail).toBe('agent@example.com');
      expect(res.body.agent.domainVerified).toBe(false);
    });

    it('should reject registration without name', async () => {
      const res = await request(app)
        .post('/api/agents/register')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/agents/:id', () => {
    it('should return agent profile with zero reputation for new agent', async () => {
      const agent = await createTestAgent();

      const res = await request(app).get(`/api/agents/${agent.id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(agent.name);
      expect(res.body.reputation.totalJobs).toBe(0);
      expect(res.body.reputation.completedJobs).toBe(0);
      expect(res.body.reputation.paidJobs).toBe(0);
      expect(res.body.reputation.avgPaymentSpeedHours).toBeNull();
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await request(app).get('/api/agents/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should compute reputation from jobs', async () => {
      const agent = await createTestAgent();
      const user = await createTestUserWithProfile({ emailVerified: true });

      // Create some jobs in various states
      await prisma.job.createMany({
        data: [
          {
            humanId: user.id,
            agentId: 'test',
            registeredAgentId: agent.id,
            title: 'Job 1',
            description: 'Test',
            priceUsdc: 100,
            status: 'COMPLETED',
            acceptedAt: new Date('2025-01-01T00:00:00Z'),
            paidAt: new Date('2025-01-01T02:00:00Z'),
            completedAt: new Date('2025-01-02T00:00:00Z'),
          },
          {
            humanId: user.id,
            agentId: 'test',
            registeredAgentId: agent.id,
            title: 'Job 2',
            description: 'Test',
            priceUsdc: 50,
            status: 'PAID',
            acceptedAt: new Date('2025-01-01T00:00:00Z'),
            paidAt: new Date('2025-01-01T04:00:00Z'),
          },
          {
            humanId: user.id,
            agentId: 'test',
            registeredAgentId: agent.id,
            title: 'Job 3',
            description: 'Test',
            priceUsdc: 75,
            status: 'PENDING',
          },
        ],
      });

      const res = await request(app).get(`/api/agents/${agent.id}`);

      expect(res.status).toBe(200);
      expect(res.body.reputation.totalJobs).toBe(3);
      expect(res.body.reputation.completedJobs).toBe(1);
      expect(res.body.reputation.paidJobs).toBe(2); // PAID + COMPLETED
      expect(res.body.reputation.avgPaymentSpeedHours).toBeTypeOf('number');
    });
  });

  describe('PATCH /api/agents/:id', () => {
    it('should update agent with valid key', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .patch(`/api/agents/${agent.id}`)
        .set('X-Agent-Key', agent.apiKey)
        .send({ name: 'Updated Name', description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('New description');
    });

    it('should return 401 with wrong key', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .patch(`/api/agents/${agent.id}`)
        .set('X-Agent-Key', 'hp_wrong_key_that_is_invalid')
        .send({ name: 'Hacked' });

      expect(res.status).toBe(401);
    });

    it('should return 401 without key', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .patch(`/api/agents/${agent.id}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when updating another agent', async () => {
      const agent1 = await createTestAgent({ name: 'Agent 1' });
      const agent2 = await createTestAgent({ name: 'Agent 2' });

      const res = await request(app)
        .patch(`/api/agents/${agent2.id}`)
        .set('X-Agent-Key', agent1.apiKey)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('Job creation with agent key', () => {
    it('should create job linked to registered agent', async () => {
      const agent = await createActiveTestAgent();
      const user = await createTestUserWithProfile({ emailVerified: true });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'my-agent-id',
          title: 'Test Job',
          description: 'Do something',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();

      // Verify the job is linked to the registered agent
      const job = await prisma.job.findUnique({
        where: { id: res.body.id },
        include: { registeredAgent: true },
      });
      expect(job?.registeredAgentId).toBe(agent.id);
      expect(job?.agentName).toBe(agent.name);
    });

    it('should reject job creation without API key', async () => {
      const user = await createTestUserWithProfile({ emailVerified: true });

      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId: user.id,
          agentId: 'my-agent-id',
          title: 'Test Job',
          description: 'Do something',
          priceUsdc: 50,
        });

      expect(res.status).toBe(401);
    });

    it('should use custom agentName when provided', async () => {
      const agent = await createActiveTestAgent({ name: 'Default Name' });
      const user = await createTestUserWithProfile({ emailVerified: true });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'my-agent-id',
          agentName: 'Custom Display Name',
          title: 'Test Job',
          description: 'Do something',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);

      const job = await prisma.job.findUnique({ where: { id: res.body.id } });
      expect(job?.agentName).toBe('Custom Display Name');
    });
  });

  describe('Job endpoints include agent info', () => {
    it('should include registeredAgent in job list', async () => {
      const agent = await createTestAgent({ name: 'Visible Agent', domainVerified: true });
      const user = await createTestUserWithProfile({ emailVerified: true });

      // Create a job directly
      await prisma.job.create({
        data: {
          humanId: user.id,
          agentId: 'test',
          registeredAgentId: agent.id,
          agentName: 'Visible Agent',
          title: 'Test',
          description: 'Test',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });

      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].registeredAgent).toBeDefined();
      expect(res.body[0].registeredAgent.name).toBe('Visible Agent');
      expect(res.body[0].registeredAgent.domainVerified).toBe(true);
    });

    it('should include registeredAgent in single job GET', async () => {
      const agent = await createTestAgent({ name: 'Detail Agent', websiteUrl: 'https://detail.com' });
      const user = await createTestUserWithProfile({ emailVerified: true });

      const job = await prisma.job.create({
        data: {
          humanId: user.id,
          agentId: 'test',
          registeredAgentId: agent.id,
          title: 'Test',
          description: 'Test',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });

      const res = await request(app).get(`/api/jobs/${job.id}`);

      expect(res.status).toBe(200);
      expect(res.body.registeredAgent).toBeDefined();
      expect(res.body.registeredAgent.name).toBe('Detail Agent');
      expect(res.body.registeredAgent.websiteUrl).toBe('https://detail.com');
    });
  });

  describe('Rate limiting for registered agents', () => {
    it('should allow up to 20 jobs per hour for registered agents', async () => {
      const agent = await createActiveTestAgent();
      const user = await createTestUserWithProfile({ emailVerified: true });

      // Create a job and check the rate limit info
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'Do something',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.rateLimit.remaining).toBe(19); // 20 - 1
    });
  });
});
