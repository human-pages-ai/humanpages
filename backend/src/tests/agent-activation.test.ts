import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestAgent, createActiveTestAgent, TestAgent } from './helpers.js';

// Mock the activation payment verifier
vi.mock('../lib/blockchain/verify-activation-payment.js', () => ({
  verifyActivationPayment: vi.fn(),
}));

import { verifyActivationPayment } from '../lib/blockchain/verify-activation-payment.js';
const mockVerifyPayment = vi.mocked(verifyActivationPayment);

const VALID_TX_HASH = '0x' + 'a'.repeat(64);

describe('Agent Activation', () => {
  beforeEach(async () => {
    await cleanDatabase();
    mockVerifyPayment.mockReset();
  });

  describe('POST /api/agents/activate/social — request verification code', () => {
    it('should return a verification code and instructions', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .post('/api/agents/activate/social')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.code).toMatch(/^HP-[A-F0-9]{8}$/);
      expect(res.body.expiresAt).toBeDefined();
      expect(res.body.instructions.twitter).toContain(res.body.code);
      expect(res.body.instructions.linkedin).toContain(res.body.code);
      expect(res.body.instructions.tiktok).toContain(res.body.code);
      expect(res.body.instructions.youtube).toContain(res.body.code);
      expect(res.body.requirements).toContain('humanpages.ai');
      expect(res.body.suggestedPost).toContain('humanpages.ai');
      expect(res.body.suggestedPost).toContain(res.body.code);
    });

    it('should store the code in the database', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .post('/api/agents/activate/social')
        .set('X-Agent-Key', agent.apiKey);

      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.socialVerificationCode).toBe(res.body.code);
      expect(dbAgent?.socialCodeExpiresAt).not.toBeNull();
    });

    it('should reject BANNED agent', async () => {
      const agent = await createActiveTestAgent({ status: 'BANNED' });

      const res = await request(app)
        .post('/api/agents/activate/social')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('banned');
    });

    it('should require agent authentication', async () => {
      const res = await request(app)
        .post('/api/agents/activate/social');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/agents/activate/social/verify', () => {
    it('should reject if no code was requested', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'https://twitter.com/test/status/123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No verification code');
    });

    it('should reject expired code', async () => {
      const agent = await createTestAgent();

      // Set an expired code
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          socialVerificationCode: 'HP-12345678',
          socialCodeExpiresAt: new Date(Date.now() - 1000), // expired
        },
      });

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'https://twitter.com/test/status/123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('expired');
    });

    it('should reject unsupported platform URL', async () => {
      const agent = await createTestAgent();
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          socialVerificationCode: 'HP-12345678',
          socialCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'https://facebook.com/post/123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported platform');
    });

    it('should reject GitHub URLs (email-only registration, not phone-gated)', async () => {
      const agent = await createTestAgent();
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          socialVerificationCode: 'HP-12345678',
          socialCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'https://github.com/test/repo/issues/1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported platform');
    });

    it('should reject invalid URL', async () => {
      const agent = await createTestAgent();
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          socialVerificationCode: 'HP-12345678',
          socialCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'not-a-url' });

      expect(res.status).toBe(400);
    });

    it('should reject BANNED agent', async () => {
      const agent = await createActiveTestAgent({ status: 'BANNED' });
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          socialVerificationCode: 'HP-12345678',
          socialCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/agents/activate/social/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ postUrl: 'https://twitter.com/test/status/123' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/agents/activate/status', () => {
    it('should return PENDING status for new agent', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .get('/api/agents/activate/status')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.tier).toBe('BASIC'); // default tier
    });

    it('should return ACTIVE status with tier info for activated agent', async () => {
      const agent = await createActiveTestAgent({ status: 'ACTIVE', tier: 'PRO' });

      const res = await request(app)
        .get('/api/agents/activate/status')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.tier).toBe('PRO');
      expect(res.body.limits).toBeDefined();
      expect(res.body.limits.jobOffers).toBe(30);
      expect(res.body.limits.profileViews).toBe(100);
    });

    it('should return EXPIRED for agent with expired activation', async () => {
      const agent = await createActiveTestAgent({ expiresInDays: -1 });

      const res = await request(app)
        .get('/api/agents/activate/status')
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXPIRED');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/agents/activate/status');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/agents/activate/payment — payment instructions', () => {
    it('should return payment instructions', async () => {
      const agent = await createTestAgent();

      // Set env vars
      const origAddr = process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;
      const origFee = process.env.AGENT_ACTIVATION_FEE_USD;
      process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS = '0x' + '1'.repeat(40);
      process.env.AGENT_ACTIVATION_FEE_USD = '10';

      try {
        const res = await request(app)
          .post('/api/agents/activate/payment')
          .set('X-Agent-Key', agent.apiKey);

        expect(res.status).toBe(200);
        expect(res.body.depositAddress).toBe('0x' + '1'.repeat(40));
        expect(res.body.amount).toBe(10);
        expect(res.body.acceptedTokens).toContain('USDC');
        expect(res.body.acceptedNetworks).toContain('ethereum');
        expect(res.body.tier).toBe('PRO');
        expect(res.body.durationDays).toBe(60);
      } finally {
        if (origAddr) process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS = origAddr;
        else delete process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;
        if (origFee) process.env.AGENT_ACTIVATION_FEE_USD = origFee;
        else delete process.env.AGENT_ACTIVATION_FEE_USD;
      }
    });

    it('should return 503 if deposit address not configured', async () => {
      const agent = await createTestAgent();

      const origAddr = process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;
      delete process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;

      try {
        const res = await request(app)
          .post('/api/agents/activate/payment')
          .set('X-Agent-Key', agent.apiKey);

        expect(res.status).toBe(503);
        expect(res.body.error).toContain('not configured');
      } finally {
        if (origAddr) process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS = origAddr;
      }
    });

    it('should reject BANNED agent', async () => {
      const agent = await createActiveTestAgent({ status: 'BANNED' });

      process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS = '0x' + '1'.repeat(40);

      try {
        const res = await request(app)
          .post('/api/agents/activate/payment')
          .set('X-Agent-Key', agent.apiKey);

        expect(res.status).toBe(403);
      } finally {
        delete process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;
      }
    });
  });

  describe('POST /api/agents/activate/payment/verify', () => {
    it('should activate agent with PRO tier on successful payment', async () => {
      const agent = await createTestAgent();

      mockVerifyPayment.mockResolvedValue({
        txHash: VALID_TX_HASH,
        network: 'ethereum',
        token: 'USDC',
        amount: 10,
      });

      const res = await request(app)
        .post('/api/agents/activate/payment/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          txHash: VALID_TX_HASH,
          network: 'ethereum',
          token: 'USDC',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.tier).toBe('PRO');
      expect(res.body.expiresAt).toBeDefined();

      // Verify in DB
      const dbAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(dbAgent?.status).toBe('ACTIVE');
      expect(dbAgent?.activationMethod).toBe('PAYMENT');
      expect(dbAgent?.activationTier).toBe('PRO');
      expect(dbAgent?.paymentTxHash).toBe(VALID_TX_HASH);
    });

    it('should reject duplicate txHash', async () => {
      // First activation
      const agent1 = await createTestAgent({ name: 'Agent 1' });
      mockVerifyPayment.mockResolvedValue({
        txHash: VALID_TX_HASH,
        network: 'ethereum',
        token: 'USDC',
        amount: 10,
      });

      await request(app)
        .post('/api/agents/activate/payment/verify')
        .set('X-Agent-Key', agent1.apiKey)
        .send({ txHash: VALID_TX_HASH, network: 'ethereum' });

      // Second agent tries same txHash
      const agent2 = await createTestAgent({ name: 'Agent 2' });
      const res = await request(app)
        .post('/api/agents/activate/payment/verify')
        .set('X-Agent-Key', agent2.apiKey)
        .send({ txHash: VALID_TX_HASH, network: 'ethereum' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already used');
    });

    it('should reject invalid txHash format', async () => {
      const agent = await createTestAgent();

      const res = await request(app)
        .post('/api/agents/activate/payment/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ txHash: 'invalid', network: 'ethereum' });

      expect(res.status).toBe(400);
    });

    it('should reject BANNED agent', async () => {
      const agent = await createActiveTestAgent({ status: 'BANNED' });

      const res = await request(app)
        .post('/api/agents/activate/payment/verify')
        .set('X-Agent-Key', agent.apiKey)
        .send({ txHash: VALID_TX_HASH, network: 'ethereum' });

      expect(res.status).toBe(403);
    });
  });
});
