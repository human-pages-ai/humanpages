import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestAgent, createActiveTestAgent, createTestUserWithProfile, TestUser, TestAgent } from './helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Agent Access Gating', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('requireActiveAgent middleware', () => {
    let user: TestUser;

    beforeEach(async () => {
      user = await createTestUserWithProfile({ emailVerified: true });
    });

    it('should block PENDING agent from creating jobs', async () => {
      const agent = await createTestAgent();
      // Agent defaults to PENDING status

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGENT_PENDING');
      expect(res.body.activationUrl).toBeDefined();
    });

    it('should block SUSPENDED agent from creating jobs', async () => {
      const agent = await createActiveTestAgent({ status: 'SUSPENDED' });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGENT_SUSPENDED');
    });

    it('should block BANNED agent from creating jobs', async () => {
      const agent = await createActiveTestAgent({ status: 'BANNED' });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGENT_BANNED');
    });

    it('should block agent with expired activation', async () => {
      const agent = await createActiveTestAgent({ expiresInDays: -1 }); // expired yesterday

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACTIVATION_EXPIRED');
    });

    it('should allow ACTIVE agent with valid activation to create jobs', async () => {
      const agent = await createActiveTestAgent({ status: 'ACTIVE' });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'A real job',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
    });

    it('should allow grandfathered ACTIVE agent (null expiry) to create jobs', async () => {
      const agent = await createActiveTestAgent({ expiresInDays: null });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test',
          title: 'Test Job',
          description: 'A real job',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Search endpoint — contact info stripped', () => {
    let user: TestUser;

    beforeEach(async () => {
      user = await createTestUserWithProfile({
        emailVerified: true,
        bio: 'Test bio',
        skills: ['javascript'],
        isAvailable: true,
        contactEmail: 'secret@example.com',
        telegram: '@secret_tg',
        whatsapp: '+1234567890',
        linkedinUrl: 'https://linkedin.com/in/secret',
        twitterUrl: 'https://twitter.com/secret',
        websiteUrl: 'https://secret.example.com',
      });
    });

    it('should NOT return contact info in search results', async () => {
      const res = await request(app)
        .get('/api/humans/search?skill=javascript');

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);

      const result = res.body.results[0];
      // Should have public info (name excluded for privacy)
      expect(result.name).toBeUndefined();
      expect(result.username).toBeDefined();
      expect(result.bio).toBe('Test bio');
      expect(result.skills).toContain('javascript');

      // Should NOT have contact info
      expect(result.contactEmail).toBeUndefined();
      expect(result.telegram).toBeUndefined();
      expect(result.whatsapp).toBeUndefined();
      expect(result.linkedinUrl).toBeUndefined();
      expect(result.twitterUrl).toBeUndefined();
      expect(result.websiteUrl).toBeUndefined();
      expect(result.wallets).toBeUndefined();
    });
  });

  describe('Public profile endpoint — contact info stripped', () => {
    let user: TestUser;

    beforeEach(async () => {
      user = await createTestUserWithProfile({
        emailVerified: true,
        username: 'testpublic',
        bio: 'Public bio',
        contactEmail: 'private@example.com',
        telegram: '@private_tg',
        websiteUrl: 'https://private.example.com',
      });
    });

    it('GET /:id should NOT return contact info', async () => {
      const res = await request(app)
        .get(`/api/humans/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.body.bio).toBe('Public bio');
      expect(res.body.contactEmail).toBeUndefined();
      expect(res.body.telegram).toBeUndefined();
      expect(res.body.websiteUrl).toBeUndefined();
      expect(res.body.wallets).toBeUndefined();
    });

    it('GET /u/:username should NOT return contact info', async () => {
      const res = await request(app)
        .get('/api/humans/u/testpublic');

      expect(res.status).toBe(200);
      expect(res.body.bio).toBe('Public bio');
      expect(res.body.contactEmail).toBeUndefined();
      expect(res.body.telegram).toBeUndefined();
      expect(res.body.websiteUrl).toBeUndefined();
    });
  });

  describe('GET /:id/profile — active agent only', () => {
    let user: TestUser;

    beforeEach(async () => {
      user = await createTestUserWithProfile({
        emailVerified: true,
        bio: 'Full profile bio',
        contactEmail: 'contact@example.com',
        telegram: '@contact_tg',
        websiteUrl: 'https://contact.example.com',
        hideContact: false,
      });
    });

    it('should return full profile with contact info for ACTIVE agent', async () => {
      const agent = await createActiveTestAgent({ status: 'ACTIVE' });

      const res = await request(app)
        .get(`/api/humans/${user.id}/profile`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.bio).toBe('Full profile bio');
      expect(res.body.contactEmail).toBe('contact@example.com');
      expect(res.body.telegram).toBe('@contact_tg');
      expect(res.body.websiteUrl).toBe('https://contact.example.com');
    });

    it('should return 401 without agent key', async () => {
      const res = await request(app)
        .get(`/api/humans/${user.id}/profile`);

      expect(res.status).toBe(401);
    });

    it('should return 403 for PENDING agent', async () => {
      const agent = await createTestAgent(); // defaults to PENDING

      const res = await request(app)
        .get(`/api/humans/${user.id}/profile`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGENT_PENDING');
    });

    it('should return 404 for non-existent human', async () => {
      const agent = await createActiveTestAgent({ status: 'ACTIVE' });

      const res = await request(app)
        .get('/api/humans/nonexistent/profile')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(404);
    });
  });

  describe('Email digest mode in profile', () => {
    let user: TestUser;

    beforeEach(async () => {
      user = await createTestUserWithProfile({ emailVerified: true });
    });

    it('should update emailDigestMode to HOURLY', async () => {
      const res = await request(app)
        .patch('/api/humans/me')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ emailDigestMode: 'HOURLY' });

      expect(res.status).toBe(200);

      // Verify in DB
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.emailDigestMode).toBe('HOURLY');
    });

    it('should update emailDigestMode to DAILY', async () => {
      const res = await request(app)
        .patch('/api/humans/me')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ emailDigestMode: 'DAILY' });

      expect(res.status).toBe(200);
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.emailDigestMode).toBe('DAILY');
    });

    it('should reject invalid emailDigestMode', async () => {
      const res = await request(app)
        .patch('/api/humans/me')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ emailDigestMode: 'WEEKLY' });

      expect(res.status).toBe(400);
    });
  });
});
