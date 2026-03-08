import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../lib/prisma.js';
import {
  cleanDatabase,
  createTestUser,
  createActiveTestAgent,
  createStreamJob,
} from './helpers.js';
import { Decimal } from '@prisma/client/runtime/library';

// Mock superfluid functions
const mockGetFlowInfo = vi.fn();
const mockCalculateTotalStreamed = vi.fn();

vi.mock('../lib/blockchain/superfluid.js', () => ({
  getFlowInfo: (...args: any[]) => mockGetFlowInfo(...args),
  calculateTotalStreamed: (...args: any[]) => mockCalculateTotalStreamed(...args),
  verifyFlow: vi.fn(),
}));

// Mock email/telegram/webhook to prevent actual sends
vi.mock('../lib/email.js', () => ({
  sendStreamFlowStoppedEmail: vi.fn(async () => {}),
}));

vi.mock('../lib/telegram.js', () => ({
  sendTelegramMessage: vi.fn(async () => {}),
}));

vi.mock('../lib/webhook.js', () => ({
  fireWebhook: vi.fn(),
}));

import {
  processSuperfluidStreams,
  processMicroTransferStreams,
} from '../lib/stream-monitor.js';

describe('Stream Monitor', () => {
  let user: { id: string; token: string };
  let agent: { id: string; apiKey: string };

  beforeEach(async () => {
    vi.resetAllMocks();
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
  });

  describe('Superfluid stream monitoring', () => {
    it('should create checkpoint tick when flow is active', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
        rateUsdc: 10,
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

      mockGetFlowInfo.mockResolvedValue({
        lastUpdated: BigInt(Math.floor(Date.now() / 1000) - 3600),
        flowRate: BigInt(115740740740740),
        deposit: BigInt(1000000000000000000),
        owedDeposit: BigInt(0),
      });
      mockCalculateTotalStreamed.mockReturnValue(4.17);

      await processSuperfluidStreams();

      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
      expect(ticks[0].status).toBe('VERIFIED');
      expect(ticks[0].amount?.toNumber()).toBeCloseTo(4.17);

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.streamTickCount).toBe(1);
      expect(updatedJob?.streamTotalPaid?.toNumber()).toBeCloseTo(4.17);
    });

    it('should auto-pause when Superfluid flow disappears', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
        rateUsdc: 10,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamSuperToken: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b',
          streamSenderAddress: '0xTestAgentAddr',
          streamFlowRate: '115740740740740',
          streamStartedAt: new Date(Date.now() - 86400000),
          streamTotalPaid: new Decimal(10),
        },
      });

      // Flow deleted (flowRate = 0)
      mockGetFlowInfo.mockResolvedValue({
        lastUpdated: BigInt(Math.floor(Date.now() / 1000) - 3600),
        flowRate: 0n,
        deposit: 0n,
        owedDeposit: 0n,
      });
      mockCalculateTotalStreamed.mockReturnValue(10.5);

      await processSuperfluidStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.status).toBe('PAUSED');
      expect(updatedJob?.streamPausedAt).not.toBeNull();

      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
      expect(ticks[0].status).toBe('VERIFIED');
    });

    it('should update flow rate when it changes', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
        rateUsdc: 10,
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

      const newFlowRate = BigInt(231481481481481);
      mockGetFlowInfo.mockResolvedValue({
        lastUpdated: BigInt(Math.floor(Date.now() / 1000) - 1800),
        flowRate: newFlowRate,
        deposit: BigInt(2000000000000000000),
        owedDeposit: BigInt(0),
      });
      mockCalculateTotalStreamed.mockReturnValue(8.33);

      await processSuperfluidStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.streamFlowRate).toBe(newFlowRate.toString());
    });

    it('should complete stream when max ticks reached', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'SUPERFLUID',
        rateUsdc: 10,
        maxTicks: 2,
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
          streamTickCount: 1,
        },
      });

      mockGetFlowInfo.mockResolvedValue({
        lastUpdated: BigInt(Math.floor(Date.now() / 1000) - 3600),
        flowRate: BigInt(115740740740740),
        deposit: BigInt(1000000000000000000),
        owedDeposit: BigInt(0),
      });
      mockCalculateTotalStreamed.mockReturnValue(20);

      await processSuperfluidStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.status).toBe('COMPLETED');
      expect(updatedJob?.streamEndedAt).not.toBeNull();
    });
  });

  describe('Micro-transfer stream monitoring', () => {
    it('should mark expired pending ticks as MISSED', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamGraceTicks: 3, // High threshold so it won't auto-pause from 1 miss
        },
      });

      // Tick past its grace deadline
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      });

      await processMicroTransferStreams();

      const tick = await prisma.streamTick.findFirst({
        where: { jobId: job.id, tickNumber: 1 },
      });
      expect(tick?.status).toBe('MISSED');

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.streamMissedTicks).toBe(1);
    });

    it('should auto-pause after consecutive misses exceed grace ticks', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamMissedTicks: 0,
          streamGraceTicks: 1,
        },
      });

      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      });

      await processMicroTransferStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.status).toBe('PAUSED');
      expect(updatedJob?.streamPausedAt).not.toBeNull();
    });

    it('should not auto-pause if misses are below grace threshold', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamMissedTicks: 0,
          streamGraceTicks: 3,
        },
      });

      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'PENDING',
          expectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      });

      await processMicroTransferStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.status).toBe('STREAMING');
      expect(updatedJob?.streamMissedTicks).toBe(1);
    });

    it('should create next pending tick when interval elapsed after verified tick', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamTickCount: 1,
        },
      });

      // Verified tick from 25 hours ago (past DAILY interval)
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 1,
          status: 'VERIFIED',
          expectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() - 25 * 60 * 60 * 1000),
          verifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          amount: new Decimal(10),
        },
      });

      await processMicroTransferStreams();

      const ticks = await prisma.streamTick.findMany({
        where: { jobId: job.id },
        orderBy: { tickNumber: 'asc' },
      });
      expect(ticks).toHaveLength(2);
      expect(ticks[0].status).toBe('VERIFIED');
      expect(ticks[1].status).toBe('PENDING');
      expect(ticks[1].tickNumber).toBe(2);
    });

    it('should not create next tick if already has a pending tick', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamTickCount: 1,
        },
      });

      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 2,
          status: 'PENDING',
          expectedAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() + 18 * 60 * 60 * 1000),
        },
      });

      await processMicroTransferStreams();

      const ticks = await prisma.streamTick.findMany({ where: { jobId: job.id } });
      expect(ticks).toHaveLength(1);
    });

    it('should complete micro-transfer stream when max ticks reached', async () => {
      const job = await createStreamJob({
        humanId: user.id,
        agentId: 'test-agent',
        registeredAgentId: agent.id,
        method: 'MICRO_TRANSFER',
        rateUsdc: 10,
        interval: 'DAILY',
        maxTicks: 2,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'STREAMING',
          streamNetwork: 'base',
          streamToken: 'USDC',
          streamTickCount: 2, // Already at max
        },
      });

      // No pending tick, verified tick exists
      await prisma.streamTick.create({
        data: {
          jobId: job.id,
          tickNumber: 2,
          status: 'VERIFIED',
          expectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          graceDeadline: new Date(Date.now() - 25 * 60 * 60 * 1000),
          verifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          amount: new Decimal(10),
        },
      });

      await processMicroTransferStreams();

      const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updatedJob?.status).toBe('COMPLETED');
      expect(updatedJob?.streamEndedAt).not.toBeNull();
    });
  });
});
