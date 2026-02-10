/**
 * Integration Test: Complete Job Lifecycle Flow
 *
 * Simulates the full marketplace interaction between an AI agent and a human:
 *   1. Agent creates job offer → human receives
 *   2. Agent updates the offer (revise price)
 *   3. Human accepts the offer (price locks)
 *   4. Agent cannot update after acceptance
 *   5. Agent pays on-chain (mocked verification)
 *   6. Human marks job as complete
 *   7. Agent leaves review
 *   8. Verify trust score and reputation updated
 *
 * Also tests:
 *   - Job rejection flow
 *   - Job messaging between agent and human
 *   - Anti-dusting (payment before acceptance rejected)
 *   - Duplicate review prevention
 *   - Offer filtering (price, distance)
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

// Mock the blockchain verification module
vi.mock('../../lib/blockchain/verify-payment.js', () => ({
  verifyUsdcPayment: vi.fn(),
}));

// Mock email
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

import { verifyUsdcPayment } from '../../lib/blockchain/verify-payment.js';
const mockVerifyUsdcPayment = vi.mocked(verifyUsdcPayment);

const VALID_TX_HASH = '0x' + 'a'.repeat(64);

function mockSuccessfulPayment(amount = 100) {
  mockVerifyUsdcPayment.mockResolvedValue({
    verified: true,
    txHash: VALID_TX_HASH,
    network: 'ethereum',
    token: 'USDC',
    from: '0x' + '1'.repeat(40),
    to: '0x' + '2'.repeat(40),
    amount,
    confirmations: 100,
  });
}

let human: TestUser;
let agent: TestAgent;

beforeEach(async () => {
  await cleanDatabase();
  mockVerifyUsdcPayment.mockReset();
  mockSuccessfulPayment();

  // Create human with wallet and verified email
  human = await createTestUser({ email: 'worker@example.com', name: 'Worker Human' });
  await prisma.human.update({
    where: { id: human.id },
    data: {
      emailVerified: true,
      isAvailable: true,
      skills: ['photography', 'delivery'],
      location: 'San Francisco, CA',
      locationLat: 37.7749,
      locationLng: -122.4194,
      contactEmail: 'worker@example.com',
    },
  });

  // Add wallet for payment
  await prisma.wallet.create({
    data: {
      humanId: human.id,
      network: 'ethereum',
      address: '0x' + '2'.repeat(40),
    },
  });

  // Create active agent
  agent = await createActiveTestAgent({ name: 'TaskBot AI', tier: 'BASIC' });
});

describe('Flow: Complete Job Lifecycle', () => {

  it('should complete full happy path: create → update → accept → pay → complete → review → verify reputation', async () => {
    // ─── Step 1: Agent creates job offer ───────────────────────────────
    const createRes = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.0.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'external-agent-id',
        agentName: 'TaskBot AI',
        title: 'Take photos of Golden Gate Bridge',
        description: 'Need 10 high-res photos from different angles.',
        category: 'photography',
        priceUsdc: 80,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('PENDING');
    expect(createRes.body.rateLimit).toBeDefined();
    expect(createRes.body.rateLimit.remaining).toBeTypeOf('number');
    const jobId = createRes.body.id;

    // ─── Step 2: Agent updates offer (revise price) ────────────────────
    const updateRes = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ priceUsdc: 100, title: 'Updated: Take 10 photos of Golden Gate' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.updateCount).toBe(1);

    // Verify update persisted
    const jobCheck = await request(app).get(`/api/jobs/${jobId}`);
    expect(parseFloat(jobCheck.body.priceUsdc)).toBe(100);
    expect(jobCheck.body.title).toContain('Updated');

    // ─── Step 3: Agent sends a message ─────────────────────────────────
    const agentMsgRes = await request(app)
      .post(`/api/jobs/${jobId}/messages`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ content: 'Hi! I need these photos by Friday.' });

    expect(agentMsgRes.status).toBe(201);
    expect(agentMsgRes.body.senderType).toBe('agent');
    expect(agentMsgRes.body.content).toContain('Friday');

    // ─── Step 4: Human reads messages and replies ──────────────────────
    const messagesRes = await authRequest(human.token).get(`/api/jobs/${jobId}/messages`);
    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body).toHaveLength(1);

    const humanMsgRes = await authRequest(human.token)
      .post(`/api/jobs/${jobId}/messages`)
      .send({ content: 'Got it! I can have them ready by Thursday.' });

    expect(humanMsgRes.status).toBe(201);
    expect(humanMsgRes.body.senderType).toBe('human');

    // Verify both messages exist
    const allMsgs = await authRequest(human.token).get(`/api/jobs/${jobId}/messages`);
    expect(allMsgs.body).toHaveLength(2);

    // ─── Step 5: Human views their pending jobs ────────────────────────
    const jobsListRes = await authRequest(human.token).get('/api/jobs');
    expect(jobsListRes.status).toBe(200);
    expect(jobsListRes.body).toHaveLength(1);
    expect(jobsListRes.body[0].status).toBe('PENDING');

    // ─── Step 6: Human accepts the offer ───────────────────────────────
    const acceptRes = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/accept`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe('ACCEPTED');

    // ─── Step 7: Agent cannot update after acceptance ──────────────────
    const failUpdateRes = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ title: 'Should fail' });

    expect(failUpdateRes.status).toBe(400);
    expect(failUpdateRes.body.error).toBe('Cannot update offer');

    // ─── Step 8: Agent pays on-chain ───────────────────────────────────
    const payRes = await request(app)
      .patch(`/api/jobs/${jobId}/paid`)
      .send({
        paymentTxHash: VALID_TX_HASH,
        paymentNetwork: 'ethereum',
        paymentAmount: 100,
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.status).toBe('PAID');
    expect(payRes.body.verification).toBeDefined();
    expect(payRes.body.verification.amount).toBe(100);

    // ─── Step 9: Human marks job as complete ───────────────────────────
    const completeRes = await authRequest(human.token)
      .patch(`/api/jobs/${jobId}/complete`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('COMPLETED');

    // ─── Step 10: Agent leaves review ──────────────────────────────────
    const reviewRes = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 5, comment: 'Perfect photos, delivered ahead of schedule!' });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.rating).toBe(5);

    // ─── Step 11: Verify reputation updated ────────────────────────────
    const reviewsRes = await request(app)
      .get(`/api/jobs/human/${human.id}/reviews`);

    expect(reviewsRes.status).toBe(200);
    expect(reviewsRes.body.stats.totalReviews).toBe(1);
    expect(reviewsRes.body.stats.averageRating).toBe(5);
    expect(reviewsRes.body.stats.completedJobs).toBe(1);

    // ─── Step 12: Verify public profile shows reputation ───────────────
    const profileRes = await request(app).get(`/api/humans/${human.id}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.reputation.jobsCompleted).toBe(1);
    expect(profileRes.body.reputation.avgRating).toBe(5);

    // ─── Step 13: Verify agent reputation ──────────────────────────────
    const agentRes = await request(app).get(`/api/agents/${agent.id}`);
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.reputation.totalJobs).toBe(1);
    expect(agentRes.body.reputation.completedJobs).toBe(1);
  });

  it('should handle job rejection flow', async () => {
    // Create offer
    const createRes = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.1.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'reject-test',
        title: 'Bad offer',
        description: 'This will be rejected',
        priceUsdc: 5,
      });
    expect(createRes.status).toBe(201);

    // Human rejects
    const rejectRes = await authRequest(human.token)
      .patch(`/api/jobs/${createRes.body.id}/reject`);

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('REJECTED');

    // Cannot accept a rejected job
    const acceptRes = await authRequest(human.token)
      .patch(`/api/jobs/${createRes.body.id}/accept`);
    expect(acceptRes.status).toBe(400);
  });

  it('should prevent anti-dusting: reject payment for non-accepted job', async () => {
    const createRes = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.2.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'dust-test',
        title: 'Dust attack test',
        description: 'Try to pay before acceptance',
        priceUsdc: 50,
      });

    const payRes = await request(app)
      .patch(`/api/jobs/${createRes.body.id}/paid`)
      .send({
        paymentTxHash: VALID_TX_HASH,
        paymentNetwork: 'ethereum',
        paymentAmount: 50,
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.error).toBe('Payment rejected');
  });

  it('should prevent duplicate reviews', async () => {
    // Create → accept → pay → complete → review → try duplicate
    const createRes = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.3.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'dupe-review',
        title: 'Duplicate review test',
        description: 'Test duplicate',
        priceUsdc: 100,
      });

    const jobId = createRes.body.id;

    await authRequest(human.token).patch(`/api/jobs/${jobId}/accept`);
    await request(app).patch(`/api/jobs/${jobId}/paid`).send({
      paymentTxHash: VALID_TX_HASH,
      paymentNetwork: 'ethereum',
      paymentAmount: 100,
    });
    await authRequest(human.token).patch(`/api/jobs/${jobId}/complete`);

    // First review
    const review1 = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 5, comment: 'Great!' });
    expect(review1.status).toBe(201);

    // Second review — should fail
    const review2 = await request(app)
      .post(`/api/jobs/${jobId}/review`)
      .send({ rating: 1, comment: 'Changed my mind!' });
    expect(review2.status).toBe(400);
    expect(review2.body.error).toContain('already been reviewed');
  });

  it('should enforce offer filter: minimum price', async () => {
    await prisma.human.update({
      where: { id: human.id },
      data: { minOfferPrice: 100 },
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.4.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'filter-test',
        title: 'Cheap offer',
        description: 'Below minimum',
        priceUsdc: 50,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRICE_TOO_LOW');
  });

  it('should enforce offer filter: distance too far', async () => {
    await prisma.human.update({
      where: { id: human.id },
      data: { maxOfferDistance: 50 },
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.5.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'far-agent',
        title: 'Far away',
        description: 'Too far',
        priceUsdc: 100,
        agentLat: 40.7128,  // New York
        agentLng: -74.006,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_FAR');
  });

  it('should enforce offer filter: location required', async () => {
    await prisma.human.update({
      where: { id: human.id },
      data: { maxOfferDistance: 50 },
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.6.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'no-loc-agent',
        title: 'No location',
        description: 'Missing coords',
        priceUsdc: 100,
        // No agentLat/agentLng
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LOCATION_REQUIRED');
  });

  it('should filter jobs by status', async () => {
    // Create two jobs
    await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.7.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({ humanId: human.id, agentId: 'a1', title: 'Job 1', description: 'D', priceUsdc: 50 });

    const job2Res = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.7.2')
      .set('X-Agent-Key', agent.apiKey)
      .send({ humanId: human.id, agentId: 'a2', title: 'Job 2', description: 'D', priceUsdc: 75 });

    // Accept job 2
    await authRequest(human.token).patch(`/api/jobs/${job2Res.body.id}/accept`);

    // Filter by PENDING
    const pendingRes = await authRequest(human.token).get('/api/jobs?status=PENDING');
    expect(pendingRes.body).toHaveLength(1);
    expect(pendingRes.body[0].title).toBe('Job 1');

    // Filter by ACCEPTED
    const acceptedRes = await authRequest(human.token).get('/api/jobs?status=ACCEPTED');
    expect(acceptedRes.body).toHaveLength(1);
    expect(acceptedRes.body[0].title).toBe('Job 2');
  });

  it('should not allow human to accept job they do not own', async () => {
    const otherHuman = await createTestUser({ email: 'other@example.com', name: 'Other' });

    const createRes = await request(app)
      .post('/api/jobs')
      .set('X-Forwarded-For', '10.50.8.1')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        humanId: human.id,
        agentId: 'auth-test',
        title: 'Auth test',
        description: 'Test',
        priceUsdc: 50,
      });

    const res = await authRequest(otherHuman.token)
      .patch(`/api/jobs/${createRes.body.id}/accept`);

    expect(res.status).toBe(403);
  });
});
