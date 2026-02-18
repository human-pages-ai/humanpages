/**
 * Tests for off-chain payment flow, cancel, and dispute endpoints.
 *
 * Covers:
 *   - claim-payment: agent claims off-chain payment sent
 *   - confirm-payment: human confirms receipt
 *   - cancel: either party backs out before money/work exchanged
 *   - dispute: either party flags issue after money/work exchanged (incl. PAYMENT_CLAIMED)
 *   - Milestone-based review gating (completedAt && paidAt)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import {
  cleanDatabase,
  createTestUser,
  createActiveTestAgent,
  authRequest,
  TestUser,
  TestAgent,
} from './helpers.js';

// Mock blockchain verification (not used in off-chain flow but needed for module loading)
vi.mock('../lib/blockchain/verify-payment.js', () => ({
  verifyUsdcPayment: vi.fn(),
}));

// Mock email
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

// Mock telegram
vi.mock('../lib/telegram.js', () => ({
  sendJobOfferTelegram: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedTelegram: vi.fn(() => Promise.resolve()),
  sendTelegramMessage: vi.fn(() => Promise.resolve()),
}));

import { verifyUsdcPayment } from '../lib/blockchain/verify-payment.js';
const mockVerifyUsdcPayment = vi.mocked(verifyUsdcPayment);

let human: TestUser;
let agent: TestAgent;

/** Create a job and optionally advance it to a given status */
async function createJob(opts?: {
  status?: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'PAID' | 'PAYMENT_CLAIMED' | 'PAUSED';
  paymentTiming?: 'upfront' | 'upon_completion';
  priceUsdc?: number;
}) {
  const price = opts?.priceUsdc ?? 100;

  const res = await request(app)
    .post('/api/jobs')
    .set('X-Forwarded-For', '10.50.0.1')
    .set('X-Agent-Key', agent.apiKey)
    .send({
      humanId: human.id,
      agentId: 'ext-agent',
      agentName: 'TaskBot',
      title: 'Test Job',
      description: 'Test description',
      priceUsdc: price,
      paymentTiming: opts?.paymentTiming ?? 'upfront',
    });

  expect(res.status).toBe(201);
  const jobId = res.body.id;
  const targetStatus = opts?.status ?? 'PENDING';

  if (targetStatus === 'PENDING') return jobId;

  // Accept
  await authRequest(human.token).patch(`/api/jobs/${jobId}/accept`);
  if (targetStatus === 'ACCEPTED') return jobId;

  if (targetStatus === 'COMPLETED') {
    // For upon-completion flow: ACCEPTED → COMPLETED
    await prisma.human.update({
      where: { id: human.id },
      data: { paymentPreferences: ['UPFRONT', 'UPON_COMPLETION'] },
    });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);
    return jobId;
  }

  if (targetStatus === 'PAYMENT_CLAIMED') {
    // ACCEPTED → PAYMENT_CLAIMED
    await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal', note: 'Ref #123' });
    return jobId;
  }

  if (targetStatus === 'PAID') {
    // ACCEPTED → PAYMENT_CLAIMED → PAID
    await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal' });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);
    return jobId;
  }

  if (targetStatus === 'PAUSED') {
    // Create as stream job directly
    const job = await prisma.job.create({
      data: {
        humanId: human.id,
        agentId: 'ext-agent',
        registeredAgentId: agent.id,
        title: 'Stream Job',
        description: 'Test',
        priceUsdc: price,
        paymentMode: 'STREAM',
        streamMethod: 'MICRO_TRANSFER',
        streamInterval: 'DAILY',
        streamRateUsdc: 10,
        status: 'PAUSED',
        acceptedAt: new Date(),
      },
    });
    return job.id;
  }

  return jobId;
}

beforeEach(async () => {
  await cleanDatabase();
  mockVerifyUsdcPayment.mockReset();

  human = await createTestUser({ email: 'worker@example.com', name: 'Worker' });
  await prisma.human.update({
    where: { id: human.id },
    data: {
      emailVerified: true,
      isAvailable: true,
      skills: ['testing'],
      contactEmail: 'worker@example.com',
    },
  });
  await prisma.wallet.create({
    data: { humanId: human.id, network: 'ethereum', address: '0x' + '2'.repeat(40) },
  });

  agent = await createActiveTestAgent({ name: 'TaskBot AI' });
});

// ═══════════════════════════════════════════════════════════════════════════
// claim-payment
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/jobs/:id/claim-payment', () => {
  it('should transition ACCEPTED → PAYMENT_CLAIMED', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal', note: 'Sent to worker@paypal.com ref #ABC' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAYMENT_CLAIMED');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.paymentClaimMethod).toBe('paypal');
    expect(job!.paymentClaimNote).toBe('Sent to worker@paypal.com ref #ABC');
    expect(job!.paymentClaimedAt).toBeTruthy();
    expect(job!.lastActionBy).toBe('AGENT');
  });

  it('should transition COMPLETED → PAYMENT_CLAIMED for upon-completion', async () => {
    const jobId = await createJob({ status: 'COMPLETED', paymentTiming: 'upon_completion' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'wise' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAYMENT_CLAIMED');
  });

  it('should reject claim from wrong agent', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });
    const otherAgent = await createActiveTestAgent({ name: 'Other Agent' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', otherAgent.apiKey)
      .send({ method: 'paypal' });

    expect(res.status).toBe(403);
  });

  it('should reject double claim', async () => {
    const jobId = await createJob({ status: 'PAYMENT_CLAIMED' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'venmo' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already claimed');
  });

  it('should reject claim if on-chain payment already exists', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });
    // Simulate on-chain payment already recorded
    await prisma.job.update({
      where: { id: jobId },
      data: { paymentTxHash: '0x' + 'a'.repeat(64), paidAt: new Date(), status: 'PAID' },
    });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('On-chain payment already recorded');
  });

  it('should reject claim from PENDING status', async () => {
    const jobId = await createJob({ status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal' });

    expect(res.status).toBe(400);
  });

  it('should require method field', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// confirm-payment
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/jobs/:id/confirm-payment', () => {
  it('should transition PAYMENT_CLAIMED → PAID', async () => {
    const jobId = await createJob({ status: 'PAYMENT_CLAIMED' });

    const res = await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.paidAt).toBeTruthy();
    expect(job!.paymentAmount!.toNumber()).toBe(100);
    expect(job!.lastActionBy).toBe('HUMAN');
  });

  it('should reject confirmation from non-owner', async () => {
    const jobId = await createJob({ status: 'PAYMENT_CLAIMED' });
    const otherHuman = await createTestUser({ email: 'other@example.com' });

    const res = await authRequest(otherHuman.token).patch(`/api/jobs/${jobId}/confirm-payment`);

    expect(res.status).toBe(403);
  });

  it('should reject confirmation on non-PAYMENT_CLAIMED job', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No payment claim');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// cancel
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/jobs/:id/cancel', () => {
  it('should allow human to cancel ACCEPTED job', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.cancelledBy).toBe('HUMAN');
    expect(job!.cancelReason).toBe('Changed my mind');
    expect(job!.cancelledAt).toBeTruthy();
  });

  it('should allow agent to withdraw PENDING offer', async () => {
    const jobId = await createJob({ status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/cancel`)
      .set('X-Agent-Key', agent.apiKey)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.message).toContain('withdrawn');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.cancelledBy).toBe('AGENT');
  });

  it('should allow human to cancel PAYMENT_CLAIMED job', async () => {
    const jobId = await createJob({ status: 'PAYMENT_CLAIMED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('should allow agent to cancel ACCEPTED job', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/cancel`)
      .set('X-Agent-Key', agent.apiKey)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('should reject human cancel on PENDING (use reject instead)', async () => {
    const jobId = await createJob({ status: 'PENDING' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should reject cancel on PAID job (use dispute)', async () => {
    const jobId = await createJob({ status: 'PAID' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.hint).toContain('dispute');
  });

  it('should reject cancel on COMPLETED job (use dispute)', async () => {
    const jobId = await createJob({ status: 'COMPLETED', paymentTiming: 'upon_completion' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.hint).toContain('dispute');
  });

  it('should reject cancel from unrelated party', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });
    const stranger = await createTestUser({ email: 'stranger@example.com' });

    const res = await authRequest(stranger.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('should allow cancel on PAUSED stream job', async () => {
    const jobId = await createJob({ status: 'PAUSED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/cancel`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// dispute
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/jobs/:id/dispute', () => {
  it('should allow human to dispute PAYMENT_CLAIMED job (replaces deny-payment)', async () => {
    const jobId = await createJob({ status: 'PAYMENT_CLAIMED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({ reason: 'Never received PayPal transfer' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISPUTED');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.disputedAt).toBeTruthy();
    expect(job!.disputeReason).toBe('Never received PayPal transfer');
    expect(job!.disputedBy).toBe('HUMAN');
    expect(job!.lastActionBy).toBe('HUMAN');
  });

  it('should allow human to dispute PAID job', async () => {
    const jobId = await createJob({ status: 'PAID' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({ reason: 'Work not as described' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISPUTED');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.disputedBy).toBe('HUMAN');
    expect(job!.disputeReason).toBe('Work not as described');
    expect(job!.disputedAt).toBeTruthy();
    expect(job!.lastActionBy).toBe('HUMAN');
  });

  it('should allow agent to dispute COMPLETED job', async () => {
    const jobId = await createJob({ status: 'COMPLETED', paymentTiming: 'upon_completion' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/dispute`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ reason: 'Work was not delivered' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISPUTED');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.disputedBy).toBe('AGENT');
  });

  it('should reject dispute on PENDING job (use cancel)', async () => {
    const jobId = await createJob({ status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/dispute`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ reason: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.hint).toContain('cancel');
  });

  it('should reject dispute on ACCEPTED job (use cancel)', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({ reason: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.hint).toContain('cancel');
  });

  it('should require a reason', async () => {
    const jobId = await createJob({ status: 'PAID' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should allow dispute on PAUSED stream job', async () => {
    const jobId = await createJob({ status: 'PAUSED' });

    const res = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({ reason: 'Stream payments stopped without notice' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISPUTED');
  });

  it('should reject dispute from unrelated party', async () => {
    const jobId = await createJob({ status: 'PAID' });
    const stranger = await createTestUser({ email: 'stranger@example.com' });

    const res = await authRequest(stranger.token)
      .patch(`/api/jobs/${jobId}/dispute`)
      .send({ reason: 'test' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Full off-chain flow integration
// ═══════════════════════════════════════════════════════════════════════════

describe('Off-chain payment: full flow', () => {
  it('upfront: ACCEPTED → PAYMENT_CLAIMED → PAID → COMPLETED', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    // Agent claims payment
    const claimRes = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal', note: 'Sent $100 via PayPal' });
    expect(claimRes.body.status).toBe('PAYMENT_CLAIMED');

    // Human confirms
    const confirmRes = await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);
    expect(confirmRes.body.status).toBe('PAID');

    // Human completes work
    const completeRes = await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);
    expect(completeRes.body.status).toBe('COMPLETED');

    // Verify both milestones set
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.paidAt).toBeTruthy();
    expect(job!.completedAt).toBeTruthy();
  });

  it('upon-completion: ACCEPTED → COMPLETED → PAYMENT_CLAIMED → PAID', async () => {
    // Set up upon-completion preferences
    await prisma.human.update({
      where: { id: human.id },
      data: { paymentPreferences: ['UPFRONT', 'UPON_COMPLETION'] },
    });

    const jobId = await createJob({ status: 'ACCEPTED', paymentTiming: 'upon_completion' });

    // Human completes work first
    const completeRes = await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);
    expect(completeRes.body.status).toBe('COMPLETED');

    // Agent claims off-chain payment
    const claimRes = await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'wise' });
    expect(claimRes.body.status).toBe('PAYMENT_CLAIMED');

    // Human confirms payment
    const confirmRes = await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);
    expect(confirmRes.body.status).toBe('PAID');

    // Both milestones set — review should be possible
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job!.completedAt).toBeTruthy();
    expect(job!.paidAt).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Milestone-based review gating
// ═══════════════════════════════════════════════════════════════════════════

describe('Review gating: milestone-based', () => {
  it('should allow review when both completedAt and paidAt are set', async () => {
    // Full off-chain upfront flow
    const jobId = await createJob({ status: 'ACCEPTED' });
    await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal' });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);
    await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);

    // Review should work
    const reviewRes = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 5, comment: 'Great work!' });

    expect(reviewRes.status).toBe(201);
  });

  it('should reject review when only completedAt is set (no payment)', async () => {
    await prisma.human.update({
      where: { id: human.id },
      data: { paymentPreferences: ['UPFRONT', 'UPON_COMPLETION'] },
    });
    const jobId = await createJob({ status: 'ACCEPTED', paymentTiming: 'upon_completion' });

    // Complete work but no payment yet
    await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);

    const reviewRes = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 4, comment: 'Good' });

    expect(reviewRes.status).toBe(400);
    expect(reviewRes.body.reason).toContain('payment');
  });

  it('should reject review when only paidAt is set (no completion)', async () => {
    const jobId = await createJob({ status: 'ACCEPTED' });

    // Pay off-chain but don't complete
    await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'paypal' });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);

    // Job is PAID but not COMPLETED
    const reviewRes = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 3 });

    expect(reviewRes.status).toBe(400);
    expect(reviewRes.body.reason).toContain('work completion');
  });

  it('should allow review after upon-completion off-chain flow', async () => {
    await prisma.human.update({
      where: { id: human.id },
      data: { paymentPreferences: ['UPFRONT', 'UPON_COMPLETION'] },
    });
    const jobId = await createJob({ status: 'ACCEPTED', paymentTiming: 'upon_completion' });

    // ACCEPTED → COMPLETED → PAYMENT_CLAIMED → PAID
    await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);
    await request(app)
      .patch(`/api/jobs/${jobId}/claim-payment`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ method: 'wise' });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/confirm-payment`);

    const reviewRes = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 5, comment: 'Excellent!' });

    expect(reviewRes.status).toBe(201);
  });
});
