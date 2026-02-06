import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PaymentVerificationError, PaymentErrorCode } from '../lib/blockchain/errors.js';

// Mock the blockchain verification module
vi.mock('../lib/blockchain/verify-payment.js', () => ({
  verifyUsdcPayment: vi.fn(),
}));

// Import after mocking
import { verifyUsdcPayment } from '../lib/blockchain/verify-payment.js';
const mockVerifyUsdcPayment = vi.mocked(verifyUsdcPayment);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Valid txHash format for tests
const VALID_TX_HASH = '0x' + 'a'.repeat(64);

// Default successful verification result
const mockSuccessfulVerification = () => {
  mockVerifyUsdcPayment.mockResolvedValue({
    verified: true,
    txHash: VALID_TX_HASH,
    network: 'ethereum',
    token: 'USDC',
    from: '0x' + '1'.repeat(40),
    to: '0x1234567890123456789012345678901234567890',
    amount: 100,
    confirmations: 100,
  });
};

describe('Jobs API - Mutual Handshake', () => {
  let humanId: string;
  let humanToken: string;
  let jobId: string;

  beforeAll(async () => {
    // Create a test human
    const passwordHash = await bcrypt.hash('password123', 10);
    const human = await prisma.human.create({
      data: {
        email: 'job-test@example.com',
        passwordHash,
        name: 'Job Test Human',
        contactEmail: 'job-test@example.com',
        wallets: {
          create: {
            network: 'ethereum',
            address: '0x1234567890123456789012345678901234567890',
          },
        },
      },
    });
    humanId = human.id;
    humanToken = jwt.sign({ userId: human.id }, JWT_SECRET, { expiresIn: '1d' });
  });

  afterAll(async () => {
    // Clean up
    await prisma.review.deleteMany({ where: { humanId } });
    await prisma.job.deleteMany({ where: { humanId } });
    await prisma.wallet.deleteMany({ where: { humanId } });
    await prisma.human.delete({ where: { id: humanId } });
  });

  beforeEach(async () => {
    // Clean up jobs before each test
    await prisma.review.deleteMany({ where: { humanId } });
    await prisma.job.deleteMany({ where: { humanId } });
    // Reset mock to default successful verification
    mockVerifyUsdcPayment.mockReset();
    mockSuccessfulVerification();
  });

  describe('POST /api/jobs - Create Job Offer', () => {
    it('should create a job offer in PENDING status', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId,
          agentId: 'test-agent-123',
          agentName: 'Test Agent',
          title: 'Take photos of storefront',
          description: 'Need 5 photos of the ABC Store on Main Street',
          category: 'photography',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.id).toBeDefined();
      jobId = res.body.id;
    });

    it('should reject job for non-existent human', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId: 'non-existent-id',
          agentId: 'test-agent-123',
          title: 'Test job',
          description: 'Test description',
          priceUsdc: 50,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/jobs/:id/accept - Human Accepts', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          title: 'Test Job',
          description: 'Test Description',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });
      jobId = job.id;
    });

    it('should allow human to accept pending job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('should reject accept from unauthorized user', async () => {
      const otherToken = jwt.sign({ userId: 'other-user-id' }, JWT_SECRET);
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject accept for already accepted job', async () => {
      // Accept first
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Try to accept again
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/jobs/:id/paid - Mark as Paid (Anti-Dusting)', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          title: 'Test Job',
          description: 'Test Description',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });
      jobId = job.id;
    });

    it('should REJECT payment for PENDING job (anti-dusting)', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Payment rejected');
      expect(res.body.reason).toContain('ACCEPTED');
    });

    it('should REJECT payment for underpayment (on-chain verification)', async () => {
      // Mock the verification to fail with insufficient amount
      mockVerifyUsdcPayment.mockRejectedValue(
        new PaymentVerificationError(
          PaymentErrorCode.AMOUNT_INSUFFICIENT,
          'Payment amount ($50.00) is less than agreed price ($100.00)',
          { actualAmount: 50, expectedAmount: 100 }
        )
      );

      // Accept the job first
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Try to pay less than agreed (on-chain verification catches this)
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 50, // Amount in request doesn't matter - on-chain is what counts
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Payment verification failed');
      expect(res.body.code).toBe('AMOUNT_INSUFFICIENT');
    });

    it('should accept payment for ACCEPTED job with correct amount', async () => {
      // Accept the job first
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Pay correct amount
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
    });
  });

  describe('POST /api/jobs/:id/review - Leave Review (Anti-Abuse)', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          title: 'Test Job',
          description: 'Test Description',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });
      jobId = job.id;
    });

    it('should REJECT review for PENDING job', async () => {
      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 1, comment: 'Bad!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Review rejected');
    });

    it('should REJECT review for ACCEPTED but not COMPLETED job', async () => {
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 1, comment: 'Bad!' });

      expect(res.status).toBe(400);
    });

    it('should REJECT review for PAID but not COMPLETED job', async () => {
      // Accept
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Pay
      await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });

      // Try to review before completion
      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 1, comment: 'Bad!' });

      expect(res.status).toBe(400);
    });

    it('should allow review for COMPLETED job', async () => {
      // Accept
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Pay
      await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });

      // Complete
      await request(app)
        .patch(`/api/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${humanToken}`);

      // Now review should work
      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 5, comment: 'Great work!' });

      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(5);
    });

    it('should prevent duplicate reviews', async () => {
      // Complete the full flow
      await request(app)
        .patch(`/api/jobs/${jobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);

      await request(app)
        .patch(`/api/jobs/${jobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });

      await request(app)
        .patch(`/api/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${humanToken}`);

      // First review
      await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 5, comment: 'Great!' });

      // Try second review
      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .send({ rating: 1, comment: 'Changed my mind!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already been reviewed');
    });
  });

  describe('GET /api/jobs/human/:humanId/reviews - Public Reviews', () => {
    it('should return reviews with stats', async () => {
      // Create a completed job with review
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          agentName: 'Test Agent',
          title: 'Completed Job',
          description: 'Test',
          priceUsdc: 100,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await prisma.review.create({
        data: {
          jobId: job.id,
          humanId,
          rating: 5,
          comment: 'Excellent!',
        },
      });

      const res = await request(app)
        .get(`/api/jobs/human/${humanId}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalReviews).toBe(1);
      expect(res.body.stats.averageRating).toBe(5);
      expect(res.body.reviews).toHaveLength(1);
    });
  });

  describe('Rate Limiting - Anti-Spam', () => {
    const spamAgentId = 'spam-agent-' + Date.now();

    beforeEach(async () => {
      // Clean up any jobs from this agent
      await prisma.job.deleteMany({ where: { agentId: spamAgentId } });
    });

    it('should allow up to 5 offers per hour', async () => {
      // Send 5 offers - all should succeed
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/jobs')
          .send({
            humanId,
            agentId: spamAgentId,
            title: `Offer ${i + 1}`,
            description: 'Test offer',
            priceUsdc: 50,
          });

        expect(res.status).toBe(201);
        expect(res.body.rateLimit.remaining).toBe(4 - i);
      }
    });

    it('should reject 6th offer within an hour (rate limit)', async () => {
      // Send 5 offers first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/jobs')
          .send({
            humanId,
            agentId: spamAgentId,
            title: `Offer ${i + 1}`,
            description: 'Test offer',
            priceUsdc: 50,
          });
      }

      // 6th offer should be rejected
      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId,
          agentId: spamAgentId,
          title: 'Spam offer',
          description: 'This should fail',
          priceUsdc: 50,
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Rate limit exceeded');
    });

    it('should track rate limits per agent independently', async () => {
      const otherAgentId = 'other-agent-' + Date.now();

      // Fill up spam agent's limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/jobs')
          .send({
            humanId,
            agentId: spamAgentId,
            title: `Spam ${i + 1}`,
            description: 'Test',
            priceUsdc: 50,
          });
      }

      // Other agent should still be able to send offers
      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId,
          agentId: otherAgentId,
          title: 'Different agent offer',
          description: 'This should work',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);

      // Clean up other agent's job
      await prisma.job.deleteMany({ where: { agentId: otherAgentId } });
    });
  });
});
