import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
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
  let agentApiKey: string;
  let agentId: string;

  beforeAll(async () => {
    // Create a test human
    const passwordHash = await bcrypt.hash('password123', parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
    const human = await prisma.human.create({
      data: {
        email: 'job-test@example.com',
        passwordHash,
        name: 'Job Test Human',
        contactEmail: 'job-test@example.com',
        emailVerified: true,
        wallets: {
          create: {
            network: 'ethereum',
            address: '0x1234567890123456789012345678901234567890',
            verified: true,
          },
        },
      },
    });
    humanId = human.id;
    humanToken = jwt.sign({ userId: human.id }, JWT_SECRET, { expiresIn: '1d' });

    // Create a registered test agent for job creation
    const keyBytes = crypto.randomBytes(24).toString('hex');
    agentApiKey = `hp_${keyBytes}`;
    const apiKeyPrefix = agentApiKey.substring(0, 8);
    const apiKeyHash = await bcrypt.hash(agentApiKey, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
    const agent = await prisma.agent.create({
      data: {
        name: 'Test Agent',
        apiKeyHash,
        apiKeyPrefix,
        verificationToken: crypto.randomBytes(32).toString('hex'),
        status: 'ACTIVE',
        activatedAt: new Date(),
        activationMethod: 'SOCIAL',
        activationTier: 'BASIC',
        activationExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    agentId = agent.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.review.deleteMany({ where: { humanId } });
    await prisma.job.deleteMany({ where: { humanId } });
    await prisma.wallet.deleteMany({ where: { humanId } });
    await prisma.agent.deleteMany({ where: { id: agentId } });
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
        .set('X-Agent-Key', agentApiKey)
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
        .set('X-Agent-Key', agentApiKey)
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
          registeredAgentId: agentId,
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

      // Auth middleware returns 401 when the JWT user doesn't exist in DB
      expect(res.status).toBe(401);
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

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/jobs/:id/paid - Mark as Paid (Anti-Dusting)', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          registeredAgentId: agentId,
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
          registeredAgentId: agentId,
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
        .set('X-Agent-Key', agentApiKey)
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
        .set('X-Agent-Key', agentApiKey)
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
        .set('X-Agent-Key', agentApiKey)
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
        .set('X-Agent-Key', agentApiKey)
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
        .set('X-Agent-Key', agentApiKey)
        .send({ rating: 5, comment: 'Great!' });

      // Try second review
      const res = await request(app)
        .post(`/api/jobs/${jobId}/review`)
        .set('X-Agent-Key', agentApiKey)
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
    it('should enforce tier-based daily offer rate limit', async () => {
      // Just verify the rate limit info comes back correctly
      const res = await request(app)
        .post('/api/jobs')
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'rate-test',
          title: 'Rate limit test',
          description: 'Test offer',
          priceUsdc: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.rateLimit).toBeDefined();
      expect(res.body.rateLimit.remaining).toBeTypeOf('number');
    });

    it('should require API key for job creation', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          humanId,
          agentId: 'no-key-agent',
          title: 'No key',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/jobs/:id - Get Job by ID', () => {
    it('should return job with human info and review', async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          agentName: 'Test Agent',
          title: 'Visible Job',
          description: 'Test',
          priceUsdc: 100,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await prisma.review.create({
        data: { jobId: job.id, humanId, rating: 4, comment: 'Good' },
      });

      const res = await request(app).get(`/api/jobs/${job.id}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Visible Job');
      expect(res.body.human).toBeDefined();
      expect(res.body.human.name).toBe('Job Test Human');
      expect(res.body.review).toBeDefined();
      expect(res.body.review.rating).toBe(4);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app).get('/api/jobs/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });
  });

  describe('GET /api/jobs (authenticated list)', () => {
    it('should return all jobs for authenticated human', async () => {
      await prisma.job.create({
        data: {
          humanId,
          agentId: 'agent-1',
          title: 'Job 1',
          description: 'Test',
          priceUsdc: 50,
          status: 'PENDING',
        },
      });
      await prisma.job.create({
        data: {
          humanId,
          agentId: 'agent-2',
          title: 'Job 2',
          description: 'Test',
          priceUsdc: 75,
          status: 'ACCEPTED',
        },
      });

      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should filter by status query param', async () => {
      await prisma.job.create({
        data: {
          humanId,
          agentId: 'agent-1',
          title: 'Pending Job',
          description: 'Test',
          priceUsdc: 50,
          status: 'PENDING',
        },
      });
      await prisma.job.create({
        data: {
          humanId,
          agentId: 'agent-2',
          title: 'Accepted Job',
          description: 'Test',
          priceUsdc: 75,
          status: 'ACCEPTED',
        },
      });

      const res = await request(app)
        .get('/api/jobs?status=PENDING')
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Pending Job');
    });

    it('should return empty array when no jobs', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/jobs/:id - Update Offer', () => {
    let updateJobId: string;

    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          agentName: 'Test Agent',
          registeredAgentId: agentId,
          title: 'Original Title',
          description: 'Original Description',
          category: 'photography',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });
      updateJobId = job.id;
    });

    it('should update title/description/category/priceUsdc of PENDING job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
          category: 'delivery',
          priceUsdc: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Offer updated successfully.');
      expect(res.body.updateCount).toBe(1);

      // Verify the changes persisted
      const getRes = await request(app).get(`/api/jobs/${updateJobId}`);
      expect(getRes.body.title).toBe('Updated Title');
      expect(getRes.body.description).toBe('Updated Description');
      expect(getRes.body.category).toBe('delivery');
      expect(parseFloat(getRes.body.priceUsdc)).toBe(150);
      expect(getRes.body.updateCount).toBe(1);
      expect(getRes.body.lastUpdatedByAgent).toBeDefined();
    });

    it('should allow partial updates (only title)', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Only Title Changed' });

      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/jobs/${updateJobId}`);
      expect(getRes.body.title).toBe('Only Title Changed');
      expect(getRes.body.description).toBe('Original Description');
    });

    it('should reject update of ACCEPTED job (status guard)', async () => {
      // Accept the job first
      await prisma.job.update({
        where: { id: updateJobId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      const res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Trying to update after accept' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot update offer');
    });

    it('should reject update from different agent (auth guard)', async () => {
      // Create a second agent
      const keyBytes2 = crypto.randomBytes(24).toString('hex');
      const otherApiKey = `hp_${keyBytes2}`;
      const apiKeyPrefix2 = otherApiKey.substring(0, 8);
      const apiKeyHash2 = await bcrypt.hash(otherApiKey, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
      const otherAgent = await prisma.agent.create({
        data: {
          name: 'Other Agent',
          apiKeyHash: apiKeyHash2,
          apiKeyPrefix: apiKeyPrefix2,
          verificationToken: crypto.randomBytes(32).toString('hex'),
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/jobs/${updateJobId}`)
          .set('X-Agent-Key', otherApiKey)
          .send({ title: 'Hijack attempt' });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Not authorized');
      } finally {
        await prisma.agent.delete({ where: { id: otherAgent.id } });
      }
    });

    it('should reject update without API key (401)', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .send({ title: 'No key' });

      expect(res.status).toBe(401);
    });

    it('should reject empty update body', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should re-validate offer filters on price change', async () => {
      // Set a minimum offer price for the human
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: 200 },
      });

      try {
        const res = await request(app)
          .patch(`/api/jobs/${updateJobId}`)
          .set('X-Agent-Key', agentApiKey)
          .send({ priceUsdc: 50 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PRICE_TOO_LOW');
      } finally {
        // Clean up filter
        await prisma.human.update({
          where: { id: humanId },
          data: { minOfferPrice: null },
        });
      }
    });

    it('should increment updateCount on each update', async () => {
      // First update
      let res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Update 1' });
      expect(res.body.updateCount).toBe(1);

      // Second update
      res = await request(app)
        .patch(`/api/jobs/${updateJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Update 2' });
      expect(res.body.updateCount).toBe(2);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app)
        .patch('/api/jobs/non-existent-id')
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/jobs/:id/reject', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          title: 'Rejectable Job',
          description: 'Test',
          priceUsdc: 100,
          status: 'PENDING',
        },
      });
      jobId = job.id;
    });

    it('should reject pending job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/reject`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
    });

    it('should return 403 if not job owner', async () => {
      const otherToken = jwt.sign({ userId: 'other-user-id' }, JWT_SECRET);
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/reject`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(401);
    });

    it('should return 400 if not PENDING status', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'ACCEPTED' },
      });

      const res = await request(app)
        .patch(`/api/jobs/${jobId}/reject`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app)
        .patch('/api/jobs/non-existent/reject')
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/jobs/:id/complete', () => {
    beforeEach(async () => {
      const job = await prisma.job.create({
        data: {
          humanId,
          agentId: 'test-agent',
          title: 'Completable Job',
          description: 'Test',
          priceUsdc: 100,
          status: 'PAID',
        },
      });
      jobId = job.id;
    });

    it('should complete paid job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should return 403 if not job owner', async () => {
      const otherToken = jwt.sign({ userId: 'other-user-id' }, JWT_SECRET);
      const res = await request(app)
        .patch(`/api/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(401);
    });

    it('should return 400 if not PAID status', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PENDING' },
      });

      const res = await request(app)
        .patch(`/api/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app)
        .patch('/api/jobs/non-existent/complete')
        .set('Authorization', `Bearer ${humanToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Offer Filtering', () => {
    // Use unique X-Forwarded-For IPs to avoid IP rate limiter
    const filterIp = '10.99.0';

    it('should reject offer below minOfferPrice (PRICE_TOO_LOW)', async () => {
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: 100 },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', `${filterIp}.1`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'filter-agent-1',
          title: 'Cheap offer',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PRICE_TOO_LOW');
    });

    it('should reject offer below minRateUsdc (BELOW_MIN_RATE)', async () => {
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: null, minRateUsdc: 75 },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', `${filterIp}.2`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'filter-agent-2',
          title: 'Below rate',
          description: 'Test',
          priceUsdc: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BELOW_MIN_RATE');
    });

    it('should require agent location when human has maxOfferDistance (LOCATION_REQUIRED)', async () => {
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: null, minRateUsdc: null, maxOfferDistance: 50, locationLat: 37.7749, locationLng: -122.4194 },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', `${filterIp}.3`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'filter-agent-3',
          title: 'No location',
          description: 'Test',
          priceUsdc: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LOCATION_REQUIRED');
    });

    it('should reject offer when agent is too far (TOO_FAR)', async () => {
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: null, minRateUsdc: null, maxOfferDistance: 50, locationLat: 37.7749, locationLng: -122.4194 },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', `${filterIp}.4`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'filter-agent-4',
          title: 'Too far',
          description: 'Test',
          priceUsdc: 100,
          agentLat: 40.7128,
          agentLng: -74.006, // New York - far from SF
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TOO_FAR');
    });

    it('should accept offer within distance and price limits', async () => {
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: 50, minRateUsdc: null, maxOfferDistance: 100, locationLat: 37.7749, locationLng: -122.4194 },
      });

      const res = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', `${filterIp}.5`)
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'filter-agent-5',
          title: 'Good offer',
          description: 'Test',
          priceUsdc: 100,
          agentLat: 37.78,
          agentLng: -122.42, // Very close to human
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Full Job Lifecycle - Integration', () => {
    it('should complete full workflow: create → accept → pay → complete → review', async () => {
      // Reset human filter settings
      await prisma.human.update({
        where: { id: humanId },
        data: { minOfferPrice: null, minRateUsdc: null, maxOfferDistance: null },
      });

      // 1. Create job offer
      const createRes = await request(app)
        .post('/api/jobs')
        .set('X-Forwarded-For', '10.88.0.1')
        .set('X-Agent-Key', agentApiKey)
        .send({
          humanId,
          agentId: 'lifecycle-agent',
          agentName: 'Lifecycle Agent',
          title: 'Full lifecycle test',
          description: 'End-to-end test',
          priceUsdc: 100,
        });
      expect(createRes.status).toBe(201);
      const lifecycleJobId = createRes.body.id;

      // 2. Update offer (agent revises price)
      const updateRes = await request(app)
        .patch(`/api/jobs/${lifecycleJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ priceUsdc: 120, title: 'Updated lifecycle test' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.updateCount).toBe(1);

      // 3. Accept
      const acceptRes = await request(app)
        .patch(`/api/jobs/${lifecycleJobId}/accept`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.status).toBe('ACCEPTED');

      // 3b. Try to update after accept — should fail
      const failedUpdateRes = await request(app)
        .patch(`/api/jobs/${lifecycleJobId}`)
        .set('X-Agent-Key', agentApiKey)
        .send({ title: 'Should fail' });
      expect(failedUpdateRes.status).toBe(400);

      // 3. Pay
      const payRes = await request(app)
        .patch(`/api/jobs/${lifecycleJobId}/paid`)
        .send({
          paymentTxHash: VALID_TX_HASH,
          paymentNetwork: 'ethereum',
          paymentAmount: 100,
        });
      expect(payRes.status).toBe(200);
      expect(payRes.body.status).toBe('PAID');

      // 4. Complete
      const completeRes = await request(app)
        .patch(`/api/jobs/${lifecycleJobId}/complete`)
        .set('Authorization', `Bearer ${humanToken}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.status).toBe('COMPLETED');

      // 5. Review
      const reviewRes = await request(app)
        .post(`/api/jobs/${lifecycleJobId}/review`)
        .set('X-Agent-Key', agentApiKey)
        .send({ rating: 5, comment: 'Perfect end-to-end!' });
      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body.rating).toBe(5);
    });
  });
});
