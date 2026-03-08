import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import {
  cleanDatabase,
  createTestUser,
  createActiveTestAgent,
  createStreamJob,
  authRequest,
} from './helpers.js';

// Mock Superfluid verification
vi.mock('../lib/blockchain/superfluid.js', () => ({
  CFA_V1_FORWARDER: '0xcfA132E353cB4E398080B9700609bb008eceB125',
  SUPER_TOKEN_ADDRESSES: {
    base: { USDC: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b' },
  },
  getSuperTokenAddress: vi.fn((network: string, token: string) => {
    if (network === 'base' && token === 'USDC') return '0xD04383398dD2426297da660F9CCA3d439AF9ce1b';
    return undefined;
  }),
  usdcPerIntervalToFlowRate: vi.fn(() => '115740740740740'),
  flowRateToUsdcPerInterval: vi.fn(() => 10),
  calculateTotalStreamed: vi.fn(() => 5.5),
  verifyFlow: vi.fn(async () => ({
    active: true,
    flowRate: '115740740740740',
    lastUpdated: Math.floor(Date.now() / 1000),
    deposit: '1000000000000000000',
    matchesExpected: true,
  })),
  isFlowActive: vi.fn(async () => false),
  getFlowInfo: vi.fn(async () => ({
    lastUpdated: BigInt(Math.floor(Date.now() / 1000)),
    flowRate: BigInt(115740740740740),
    deposit: BigInt(1000000000000000000),
    owedDeposit: BigInt(0),
  })),
}));

// Mock payment verification for micro-transfer ticks
vi.mock('../lib/blockchain/verify-payment.js', () => ({
  verifyUsdcPayment: vi.fn(async () => ({
    verified: true,
    txHash: '0x' + 'a'.repeat(64),
    network: 'base',
    token: 'USDC',
    from: '0xSender',
    to: '0xReceiver',
    amount: 10,
    confirmations: 15,
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setLogger: vi.fn(),
}));

describe('Stream Payments', () => {
  let user: { id: string; token: string };
  let agent: { id: string; apiKey: string };

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
    agent = await createActiveTestAgent();

    // Add wallet for the user
    await prisma.wallet.create({
      data: {
        humanId: user.id,
        network: 'base',
        address: '0xHumanWallet123',
        isPrimary: true,
        verified: true,
      },
    });

    // Set payment preferences to include STREAM
    await prisma.human.update({
      where: { id: user.id },
      data: { paymentPreferences: ['UPFRONT', 'ESCROW', 'UPON_COMPLETION', 'STREAM'] },
    });
  });

  describe('POST /api/jobs (stream creation)', () => {
    it('should create a Superfluid stream job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Ongoing monitoring',
          description: 'Monitor our systems daily',
          priceUsdc: 300,
          paymentMode: 'STREAM',
          streamMethod: 'SUPERFLUID',
          streamInterval: 'DAILY',
          streamRateUsdc: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');

      const job = await prisma.job.findUnique({ where: { id: res.body.id } });
      expect(job?.paymentMode).toBe('STREAM');
      expect(job?.streamMethod).toBe('SUPERFLUID');
      expect(job?.streamInterval).toBe('DAILY');
      expect(job?.streamRateUsdc?.toNumber()).toBe(10);
    });

    it('should create a micro-transfer stream job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Weekly reports',
          description: 'Write weekly reports',
          priceUsdc: 200,
          paymentMode: 'STREAM',
          streamMethod: 'MICRO_TRANSFER',
          streamInterval: 'WEEKLY',
          streamRateUsdc: 50,
          streamMaxTicks: 4,
        });

      expect(res.status).toBe(201);

      const job = await prisma.job.findUnique({ where: { id: res.body.id } });
      expect(job?.streamMethod).toBe('MICRO_TRANSFER');
      expect(job?.streamMaxTicks).toBe(4);
    });

    it('should reject stream job if human does not accept streams', async () => {
      await prisma.human.update({
        where: { id: user.id },
        data: { paymentPreferences: ['UPFRONT', 'ESCROW'] },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Streaming task',
          description: 'Test',
          priceUsdc: 100,
          paymentMode: 'STREAM',
          streamMethod: 'SUPERFLUID',
          streamInterval: 'DAILY',
          streamRateUsdc: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('STREAM_NOT_ACCEPTED');
    });

    it('should require stream fields when paymentMode=STREAM', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Missing stream fields',
          description: 'Test',
          priceUsdc: 100,
          paymentMode: 'STREAM',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('streamMethod');
    });
  });

  describe('PATCH /api/jobs/:id/start-stream (Superfluid)', () => {
    it('should verify and start a Superfluid stream', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
        rateUsdc: 10,
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/start-stream`)
        .set('X-Agent-Key', agent.apiKey)
        .send({
          senderAddress: '0xTestAgentAddr',
          network: 'base',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STREAMING');
      expect(res.body.stream.method).toBe('SUPERFLUID');

      // Verify tick was created
      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
      expect(ticks[0].status).toBe('VERIFIED');
    });
  });

  describe('PATCH /api/jobs/:id/start-stream (micro-transfer)', () => {
    it('should start a micro-transfer stream with first pending tick', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/start-stream`)
        .set('X-Agent-Key', agent.apiKey)
        .send({
          senderAddress: '0xTestAgentAddr',
          network: 'base',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STREAMING');
      expect(res.body.stream.method).toBe('MICRO_TRANSFER');

      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
      expect(ticks[0].status).toBe('PENDING');
    });
  });

  describe('PATCH /api/jobs/:id/stream-tick', () => {
    it('should verify a micro-transfer tick payment', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      // Set up as streaming with a pending tick
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING', streamNetwork: 'base', streamToken: 'USDC' },
      });
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(),
          graceDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      });

      const txHash = '0x' + 'b'.repeat(64);
      const res = await request(app)
        .patch(`/api/jobs/${job.id}/stream-tick`)
        .set('X-Agent-Key', agent.apiKey)
        .send({ txHash });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STREAMING');
      expect(res.body.tick.tickNumber).toBe(1);
      expect(res.body.totalPaid).toBe(10);

      // Verify next tick was created
      const ticks = await prisma.streamTick.findMany({
        where: { jobId: job.id },
        orderBy: { tickNumber: 'asc' },
      });
      expect(ticks).toHaveLength(2);
      expect(ticks[0].status).toBe('VERIFIED');
      expect(ticks[1].status).toBe('PENDING');
    });

    it('should complete stream when max ticks reached', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
        maxTicks: 1,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING', streamNetwork: 'base', streamToken: 'USDC' },
      });
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(),
          graceDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      });

      const txHash = '0x' + 'c'.repeat(64);
      const res = await request(app)
        .patch(`/api/jobs/${job.id}/stream-tick`)
        .set('X-Agent-Key', agent.apiKey)
        .send({ txHash });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });
  });

  describe('PATCH /api/jobs/:id/pause-stream', () => {
    it('should pause a Superfluid stream after flow is deleted', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamSuperToken: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b',
          streamSenderAddress: '0xTestAgentAddr',
          streamFlowRate: '115740740740740',
          streamStartedAt: new Date(),
        },
      });

      // isFlowActive is mocked to return false (flow deleted)
      const res = await request(app)
        .patch(`/api/jobs/${job.id}/pause-stream`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAUSED');
    });

    it('should pause a micro-transfer stream', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING', streamNetwork: 'base' },
      });
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(),
          graceDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/pause-stream`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAUSED');

      // Tick should be SKIPPED
      const tick = await prisma.streamTick.findFirst({ where: { jobId: job.id } });
      expect(tick?.status).toBe('SKIPPED');
    });
  });

  describe('PATCH /api/jobs/:id/resume-stream', () => {
    it('should resume a paused Superfluid stream', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PAUSED',
          streamNetwork: 'base',
          streamSuperToken: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b',
          streamSenderAddress: '0xTestAgentAddr',
          streamPausedAt: new Date(),
        },
      });

      // verifyFlow is mocked to return active flow
      const res = await request(app)
        .patch(`/api/jobs/${job.id}/resume-stream`)
        .set('X-Agent-Key', agent.apiKey)
        .send({ senderAddress: '0xTestAgentAddr' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STREAMING');
    });

    it('should resume a paused micro-transfer stream', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PAUSED',
          streamNetwork: 'base',
          streamPausedAt: new Date(),
        },
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/resume-stream`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STREAMING');

      // New pending tick should be created
      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
      expect(ticks[0].status).toBe('PENDING');
    });
  });

  describe('PATCH /api/jobs/:id/stop-stream', () => {
    it('should stop a streaming job', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING' },
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/stop-stream`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should stop a paused job', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'PAUSED' },
      });

      const res = await request(app)
        .patch(`/api/jobs/${job.id}/stop-stream`)
        .set('X-Agent-Key', agent.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should skip remaining pending ticks on stop', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING' },
      });
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(),
          graceDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      });

      await request(app)
        .patch(`/api/jobs/${job.id}/stop-stream`)
        .set('X-Agent-Key', agent.apiKey);

      const tick = await prisma.streamTick.findFirst({ where: { jobId: job.id } });
      expect(tick?.status).toBe('SKIPPED');
    });
  });

  describe('Messages on STREAMING/PAUSED', () => {
    it('should allow messages on STREAMING jobs', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'STREAMING' },
      });

      const res = await authRequest(user.token)
        .post(`/api/jobs/${job.id}/messages`)
        .send({ content: 'How is the stream going?' });

      expect(res.status).toBe(201);
    });

    it('should allow messages on PAUSED jobs', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'PAUSED' },
      });

      const res = await authRequest(user.token)
        .post(`/api/jobs/${job.id}/messages`)
        .send({ content: 'When will the stream resume?' });

      expect(res.status).toBe(201);
    });
  });

  describe('Upon-completion jobs', () => {
    it('should create an upon-completion job', async () => {
      await prisma.human.update({
        where: { id: user.id },
        data: { paymentPreferences: ['UPFRONT', 'UPON_COMPLETION'] },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Pay after work',
          description: 'Work first, pay later',
          priceUsdc: 50,
          paymentTiming: 'upon_completion',
        });

      expect(res.status).toBe(201);

      const job = await prisma.job.findUnique({ where: { id: res.body.id } });
      expect(job?.paymentTiming).toBe('upon_completion');
    });

    it('should reject upon-completion job if human does not accept it', async () => {
      await prisma.human.update({
        where: { id: user.id },
        data: { paymentPreferences: ['UPFRONT'] },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agent.apiKey)
        .send({
          humanId: user.id,
          agentId: 'test-agent',
          title: 'Pay after work',
          description: 'Test',
          priceUsdc: 50,
          paymentTiming: 'upon_completion',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UPON_COMPLETION_NOT_ACCEPTED');
    });
  });
});
