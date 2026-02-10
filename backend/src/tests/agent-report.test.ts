import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestAgent, createActiveTestAgent, createTestUser, createTestUserWithProfile, TestUser, TestAgent } from './helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Agent Abuse Reporting', () => {
  let user: TestUser;
  let agent: TestAgent;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUserWithProfile({ emailVerified: true });
    agent = await createActiveTestAgent({ status: 'ACTIVE' });
  });

  describe('POST /api/agents/:id/report', () => {
    it('should create a report with JWT auth', async () => {
      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          reason: 'SPAM',
          description: 'This agent sent me irrelevant offers',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toBe('Report submitted');

      // Verify report in DB
      const report = await prisma.agentReport.findFirst({
        where: { agentId: agent.id, reporterHumanId: user.id },
      });
      expect(report).not.toBeNull();
      expect(report?.reason).toBe('SPAM');
      expect(report?.description).toBe('This agent sent me irrelevant offers');
    });

    it('should create a report with email report token', async () => {
      const reportToken = jwt.sign(
        { humanId: user.id, agentId: agent.id, jobId: 'job-123', action: 'report' },
        JWT_SECRET,
        { expiresIn: '90d' }
      );

      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({
          reason: 'FRAUD',
          token: reportToken,
        });

      expect(res.status).toBe(201);
    });

    it('should reject report with mismatched agentId in token', async () => {
      const reportToken = jwt.sign(
        { humanId: user.id, agentId: 'wrong-agent', action: 'report' },
        JWT_SECRET,
        { expiresIn: '90d' }
      );

      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({
          reason: 'SPAM',
          token: reportToken,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid report token');
    });

    it('should reject expired report token', async () => {
      const reportToken = jwt.sign(
        { humanId: user.id, agentId: agent.id, action: 'report' },
        JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Wait a tick for token to expire
      await new Promise(r => setTimeout(r, 100));

      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({
          reason: 'SPAM',
          token: reportToken,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('expired');
    });

    it('should reject report without auth', async () => {
      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(401);
    });

    it('should reject invalid reason', async () => {
      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ reason: 'INVALID_REASON' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await request(app)
        .post('/api/agents/nonexistent/report')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ reason: 'SPAM' });

      expect(res.status).toBe(404);
    });

    it('should increment abuseScore on report', async () => {
      await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ reason: 'SPAM' });

      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.abuseScore).toBe(1);
    });
  });

  describe('Auto-suspension and ban thresholds', () => {
    it('should auto-suspend agent after 3 non-dismissed reports', async () => {
      // Create 3 different users to report
      const users = await Promise.all([
        createTestUser({ email: 'reporter1@example.com', name: 'Reporter 1' }),
        createTestUser({ email: 'reporter2@example.com', name: 'Reporter 2' }),
        createTestUser({ email: 'reporter3@example.com', name: 'Reporter 3' }),
      ]);

      for (const reporter of users) {
        await request(app)
          .post(`/api/agents/${agent.id}/report`)
          .set('Authorization', `Bearer ${reporter.token}`)
          .send({ reason: 'SPAM' });
      }

      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.status).toBe('SUSPENDED');
      expect(dbAgent?.abuseStrikes).toBeGreaterThanOrEqual(1);
    });

    it('should auto-ban agent after 5 non-dismissed reports', async () => {
      // Create 5 different users to report
      const users = await Promise.all([
        createTestUser({ email: 'ban1@example.com', name: 'Ban 1' }),
        createTestUser({ email: 'ban2@example.com', name: 'Ban 2' }),
        createTestUser({ email: 'ban3@example.com', name: 'Ban 3' }),
        createTestUser({ email: 'ban4@example.com', name: 'Ban 4' }),
        createTestUser({ email: 'ban5@example.com', name: 'Ban 5' }),
      ]);

      for (const reporter of users) {
        await request(app)
          .post(`/api/agents/${agent.id}/report`)
          .set('Authorization', `Bearer ${reporter.token}`)
          .send({ reason: 'FRAUD' });
      }

      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.status).toBe('BANNED');
    });

    it('should NOT auto-suspend if reports are dismissed', async () => {
      // Create reports
      const users = await Promise.all([
        createTestUser({ email: 'dis1@example.com', name: 'Dis 1' }),
        createTestUser({ email: 'dis2@example.com', name: 'Dis 2' }),
        createTestUser({ email: 'dis3@example.com', name: 'Dis 3' }),
      ]);

      // Submit first two reports
      for (const reporter of users.slice(0, 2)) {
        await request(app)
          .post(`/api/agents/${agent.id}/report`)
          .set('Authorization', `Bearer ${reporter.token}`)
          .send({ reason: 'SPAM' });
      }

      // Dismiss the two reports
      await prisma.agentReport.updateMany({
        where: { agentId: agent.id },
        data: { status: 'DISMISSED' },
      });

      // Third report — now only 1 non-dismissed
      await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .set('Authorization', `Bearer ${users[2].token}`)
        .send({ reason: 'SPAM' });

      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.status).toBe('ACTIVE'); // Still active
    });

    it('should block suspended agent from creating jobs', async () => {
      const targetUser = await createTestUserWithProfile({ emailVerified: true });

      // Create 3 reporters to trigger suspension
      const reporters = await Promise.all([
        createTestUser({ email: 'block1@example.com', name: 'Block 1' }),
        createTestUser({ email: 'block2@example.com', name: 'Block 2' }),
        createTestUser({ email: 'block3@example.com', name: 'Block 3' }),
      ]);

      for (const reporter of reporters) {
        await request(app)
          .post(`/api/agents/${agent.id}/report`)
          .set('Authorization', `Bearer ${reporter.token}`)
          .send({ reason: 'HARASSMENT' });
      }

      // Now the agent should be suspended — try to create a job
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: targetUser.id,
          agentId: 'test',
          title: 'Should fail',
          description: 'Suspended',
          priceUsdc: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGENT_SUSPENDED');
    });
  });

  describe('Report with jobId context', () => {
    it('should store jobId from report token', async () => {
      // Create a job first
      const job = await prisma.job.create({
        data: {
          humanId: user.id,
          agentId: 'test',
          registeredAgentId: agent.id,
          title: 'Test Job',
          description: 'Test',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });

      const reportToken = jwt.sign(
        { humanId: user.id, agentId: agent.id, jobId: job.id, action: 'report' },
        JWT_SECRET,
        { expiresIn: '90d' }
      );

      const res = await request(app)
        .post(`/api/agents/${agent.id}/report`)
        .send({
          reason: 'IRRELEVANT',
          description: 'This job offer is not relevant to my skills',
          token: reportToken,
        });

      expect(res.status).toBe(201);

      const report = await prisma.agentReport.findFirst({
        where: { agentId: agent.id },
      });
      expect(report?.jobId).toBe(job.id);
    });
  });
});
