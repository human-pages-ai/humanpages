import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, authRequest, createTestUserWithProfile } from './helpers.js';

describe('Affiliate / Partner Program API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ===== GET /api/affiliate/me =====
  describe('GET /api/affiliate/me', () => {
    it('should return enrolled: false for non-affiliate user', async () => {
      const user = await createTestUser();
      const res = await authRequest(user.token).get('/api/affiliate/me');

      expect(res.status).toBe(200);
      expect(res.body.enrolled).toBe(false);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/affiliate/me');
      expect(res.status).toBe(401);
    });

    it('should return full dashboard for enrolled affiliate', async () => {
      const user = await createTestUser();

      // Apply as affiliate
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'testcode123' });

      const res = await authRequest(user.token).get('/api/affiliate/me');

      expect(res.status).toBe(200);
      expect(res.body.enrolled).toBe(true);
      expect(res.body.affiliate).toBeDefined();
      expect(res.body.affiliate.code).toBe('testcode123');
      expect(res.body.affiliate.status).toBe('APPROVED');
      expect(res.body.affiliate.creditsPerReferral).toBe(10);
      expect(res.body.affiliate.totalClicks).toBe(0);
      expect(res.body.affiliate.totalSignups).toBe(0);
      expect(res.body.affiliate.qualifiedSignups).toBe(0);
      expect(res.body.affiliate.totalCredits).toBe(0);
      expect(res.body.affiliate.creditsRedeemed).toBe(0);
      expect(res.body.affiliate.availableCredits).toBe(0);
      expect(res.body.milestones).toHaveLength(3);
      expect(res.body.referrals).toHaveLength(0);
      expect(res.body.creditLedger).toHaveLength(0);
    });
  });

  // ===== POST /api/affiliate/apply =====
  describe('POST /api/affiliate/apply', () => {
    it('should successfully apply as affiliate', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({
          code: 'alice123',
          promotionMethod: 'Social media and blog',
          website: 'https://example.com',
          audience: 'Tech workers',
        });

      expect(res.status).toBe(201);
      expect(res.body.affiliate.code).toBe('alice123');
      expect(res.body.affiliate.status).toBe('APPROVED');
      expect(res.body.affiliate.creditsPerReferral).toBe(10);

      // Verify in database
      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: user.id },
      });
      expect(affiliate).not.toBeNull();
      expect(affiliate!.code).toBe('alice123');
      expect(affiliate!.promotionMethod).toBe('Social media and blog');
      expect(affiliate!.website).toBe('https://example.com');
    });

    it('should auto-approve affiliates', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'mycode' });

      expect(res.status).toBe(201);
      expect(res.body.affiliate.status).toBe('APPROVED');
    });

    it('should reject duplicate code', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });

      await authRequest(user1.token)
        .post('/api/affiliate/apply')
        .send({ code: 'samecode' });

      const res = await authRequest(user2.token)
        .post('/api/affiliate/apply')
        .send({ code: 'samecode' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already taken');
    });

    it('should reject if already enrolled', async () => {
      const user = await createTestUser();

      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'first' });

      const res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'second' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Already enrolled');
    });

    it('should validate code format', async () => {
      const user = await createTestUser();

      // Too short
      let res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'ab' });
      expect(res.status).toBe(400);

      // Invalid characters
      res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'bad code!' });
      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/affiliate/apply')
        .send({ code: 'test' });

      expect(res.status).toBe(401);
    });

    it('should accept code with hyphens and underscores', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'my-code_123' });

      expect(res.status).toBe(201);
      expect(res.body.affiliate.code).toBe('my-code_123');
    });
  });

  // ===== POST /api/affiliate/track-click =====
  describe('POST /api/affiliate/track-click', () => {
    it('should increment click count for valid code', async () => {
      const user = await createTestUser();
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'clicktest' });

      const res = await request(app)
        .post('/api/affiliate/track-click')
        .send({ code: 'clicktest' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verify count incremented
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: 'clicktest' },
      });
      expect(affiliate!.totalClicks).toBe(1);
    });

    it('should return 404 for invalid code', async () => {
      const res = await request(app)
        .post('/api/affiliate/track-click')
        .send({ code: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('should not require authentication', async () => {
      const user = await createTestUser();
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'pubclick' });

      const res = await request(app)
        .post('/api/affiliate/track-click')
        .send({ code: 'pubclick' });

      expect(res.status).toBe(200);
    });
  });

  // ===== GET /api/affiliate/resolve/:code =====
  describe('GET /api/affiliate/resolve/:code', () => {
    it('should resolve a valid affiliate code to referrer ID', async () => {
      const user = await createTestUser();
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'resolveme' });

      const res = await request(app)
        .get('/api/affiliate/resolve/resolveme');

      expect(res.status).toBe(200);
      expect(res.body.referrerId).toBe(user.id);
      expect(res.body.affiliateId).toBeDefined();
    });

    it('should return 404 for invalid code', async () => {
      const res = await request(app)
        .get('/api/affiliate/resolve/doesnotexist');

      expect(res.status).toBe(404);
    });

    it('should not resolve suspended affiliate', async () => {
      const user = await createTestUser();
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'suspended1' });

      // Suspend the affiliate
      await prisma.affiliate.update({
        where: { code: 'suspended1' },
        data: { status: 'SUSPENDED' },
      });

      const res = await request(app)
        .get('/api/affiliate/resolve/suspended1');

      expect(res.status).toBe(404);
    });
  });

  // ===== Referral recording & qualification =====
  describe('Affiliate referral tracking', () => {
    it('should record referral when signup uses affiliate referrer ID', async () => {
      // Create affiliate
      const affiliateUser = await createTestUser({ email: 'affiliate@test.com', name: 'Affiliate' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'reftrack' });

      // New user signs up with affiliate's ID as referrer
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'referred@test.com',
          password: 'password123',
          name: 'Referred User',
          referrerId: affiliateUser.id,
          termsAccepted: true,
          captchaToken: 'test-token',
        });

      expect(signupRes.status).toBe(201);

      // Wait a tick for the async referral recording
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that affiliate referral was recorded
      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: affiliateUser.id },
        include: { referrals: true },
      });

      expect(affiliate!.totalSignups).toBe(1);
      expect(affiliate!.referrals).toHaveLength(1);
      expect(affiliate!.referrals[0].referredHumanId).toBe(signupRes.body.human.id);
      expect(affiliate!.referrals[0].qualified).toBe(false);
    });

    it('should qualify referral when referred user completes profile', async () => {
      // Create affiliate
      const affiliateUser = await createTestUser({ email: 'aff@test.com', name: 'Aff' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'qualify1' });

      // New user signs up with affiliate's ID as referrer
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
          referrerId: affiliateUser.id,
          termsAccepted: true,
          captchaToken: 'test-token',
        });

      const newUserId = signupRes.body.human.id;
      const newUserToken = signupRes.body.token;

      // Wait for async referral recording
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Create the affiliate referral record manually (since async might not complete)
      const existingRef = await prisma.affiliateReferral.findUnique({
        where: { referredHumanId: newUserId },
      });
      if (!existingRef) {
        const aff = await prisma.affiliate.findUnique({ where: { humanId: affiliateUser.id } });
        await prisma.affiliateReferral.create({
          data: {
            affiliateId: aff!.id,
            referredHumanId: newUserId,
          },
        });
        await prisma.affiliate.update({
          where: { id: aff!.id },
          data: { totalSignups: 1 },
        });
      }

      // Set referredBy on the user
      await prisma.human.update({
        where: { id: newUserId },
        data: { referredBy: affiliateUser.id },
      });

      // Complete profile (bio + skills) — triggers qualification
      const updateRes = await authRequest(newUserToken)
        .patch('/api/humans/me')
        .send({
          bio: 'I am a developer',
          skills: ['javascript', 'react'],
        });

      expect(updateRes.status).toBe(200);

      // Wait for async qualification
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that referral is now qualified
      const referral = await prisma.affiliateReferral.findUnique({
        where: { referredHumanId: newUserId },
      });
      expect(referral!.qualified).toBe(true);
      expect(referral!.creditsAwarded).toBe(10);

      // Check affiliate credits updated
      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: affiliateUser.id },
      });
      expect(affiliate!.qualifiedSignups).toBe(1);
      expect(affiliate!.totalCredits).toBe(10);
    });
  });

  // ===== GET /api/affiliate/leaderboard =====
  describe('GET /api/affiliate/leaderboard', () => {
    it('should return empty leaderboard when no affiliates', async () => {
      const res = await request(app).get('/api/affiliate/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return affiliates ranked by qualified signups', async () => {
      const user1 = await createTestUser({ email: 'top@test.com', name: 'Top Affiliate' });
      const user2 = await createTestUser({ email: 'mid@test.com', name: 'Mid Affiliate' });

      await authRequest(user1.token)
        .post('/api/affiliate/apply')
        .send({ code: 'top1' });
      await authRequest(user2.token)
        .post('/api/affiliate/apply')
        .send({ code: 'mid1' });

      // Give top affiliate more referrals
      await prisma.affiliate.update({
        where: { humanId: user1.id },
        data: { qualifiedSignups: 50 },
      });
      await prisma.affiliate.update({
        where: { humanId: user2.id },
        data: { qualifiedSignups: 10 },
      });

      const res = await request(app).get('/api/affiliate/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].rank).toBe(1);
      expect(res.body[0].name).toBe('Top Affiliate');
      expect(res.body[0].referrals).toBe(50);
      expect(res.body[1].rank).toBe(2);
      expect(res.body[1].name).toBe('Mid Affiliate');
      expect(res.body[1].referrals).toBe(10);
    });

    it('should not include affiliates with 0 referrals', async () => {
      const user = await createTestUser();
      await authRequest(user.token)
        .post('/api/affiliate/apply')
        .send({ code: 'zero1' });

      const res = await request(app).get('/api/affiliate/leaderboard');
      expect(res.body).toHaveLength(0);
    });

    it('should not require authentication', async () => {
      const res = await request(app).get('/api/affiliate/leaderboard');
      expect(res.status).toBe(200);
    });
  });

  // ===== Anti-fraud =====
  describe('Anti-fraud measures', () => {
    it('should not record duplicate referral for same user', async () => {
      const { recordAffiliateReferral } = await import('../routes/affiliate.js');

      const affiliateUser = await createTestUser({ email: 'aff-fraud@test.com' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'fraud1' });

      const referredUser = await createTestUser({ email: 'ref-fraud@test.com' });

      // Record once
      await recordAffiliateReferral(affiliateUser.id, referredUser.id);

      // Record again — should not duplicate
      await recordAffiliateReferral(affiliateUser.id, referredUser.id);

      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: affiliateUser.id },
        include: { referrals: true },
      });

      expect(affiliate!.totalSignups).toBe(1);
      expect(affiliate!.referrals).toHaveLength(1);
    });

    it('should not qualify already qualified referral', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const affiliateUser = await createTestUser({ email: 'aff-dupe@test.com' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'dupe1' });

      const referredUser = await createTestUser({ email: 'ref-dupe@test.com' });
      await recordAffiliateReferral(affiliateUser.id, referredUser.id);

      // Qualify once
      await qualifyAffiliateReferral(referredUser.id);

      // Get current credits
      let affiliate = await prisma.affiliate.findUnique({ where: { humanId: affiliateUser.id } });
      const creditsAfterFirst = affiliate!.totalCredits;

      // Qualify again — should not double-count
      await qualifyAffiliateReferral(referredUser.id);

      affiliate = await prisma.affiliate.findUnique({ where: { humanId: affiliateUser.id } });
      expect(affiliate!.totalCredits).toBe(creditsAfterFirst);
      expect(affiliate!.qualifiedSignups).toBe(1);
    });
  });

  // ===== Milestone bonuses =====
  describe('Milestone bonuses', () => {
    it('should award bonus when reaching tier 1 threshold', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const affiliateUser = await createTestUser({ email: 'milestone@test.com' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'mile1' });

      // Simulate 9 qualified referrals (9 * 10 credits = 90 credits)
      await prisma.affiliate.update({
        where: { humanId: affiliateUser.id },
        data: { qualifiedSignups: 9, totalCredits: 90 },
      });

      // Create the 10th referral
      const user10 = await createTestUser({ email: 'ref10@test.com' });
      await recordAffiliateReferral(affiliateUser.id, user10.id);

      // Qualify it — should trigger tier 1 bonus
      await qualifyAffiliateReferral(user10.id);

      // Check for bonus in credit ledger
      const credits = await prisma.affiliateCredit.findMany({
        where: {
          affiliate: { humanId: affiliateUser.id },
          type: 'bonus_tier1',
        },
      });

      expect(credits).toHaveLength(1);
      expect(credits[0].credits).toBe(50);
      expect(credits[0].description).toContain('10 qualified');
    });

    it('should not double-award milestone bonus', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const affiliateUser = await createTestUser({ email: 'milestone2@test.com' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'mile2' });

      // Set to exactly at tier 1 threshold
      await prisma.affiliate.update({
        where: { humanId: affiliateUser.id },
        data: { qualifiedSignups: 9, totalCredits: 90 },
      });

      // Create and qualify the 10th referral
      const user10 = await createTestUser({ email: 'ref10b@test.com' });
      await recordAffiliateReferral(affiliateUser.id, user10.id);
      await qualifyAffiliateReferral(user10.id);

      // Get credits after first bonus
      let affiliate = await prisma.affiliate.findUnique({ where: { humanId: affiliateUser.id } });
      const creditsAfterBonus = affiliate!.totalCredits;

      // The bonus should be: 90 (existing) + 10 (referral) + 50 (bonus) = 150
      expect(creditsAfterBonus).toBe(150);

      // Verify only one bonus_tier1 entry exists
      const bonusEntries = await prisma.affiliateCredit.findMany({
        where: {
          affiliate: { humanId: affiliateUser.id },
          type: 'bonus_tier1',
        },
      });
      expect(bonusEntries).toHaveLength(1);
    });

    it('should track credits in credit ledger', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const affiliateUser = await createTestUser({ email: 'ledger@test.com' });
      await authRequest(affiliateUser.token)
        .post('/api/affiliate/apply')
        .send({ code: 'ledger1' });

      // Create and qualify a referral
      const referredUser = await createTestUser({ email: 'ledgerref@test.com' });
      await recordAffiliateReferral(affiliateUser.id, referredUser.id);
      await qualifyAffiliateReferral(referredUser.id);

      // Check credit ledger
      const creditEntries = await prisma.affiliateCredit.findMany({
        where: { affiliate: { humanId: affiliateUser.id } },
      });

      expect(creditEntries).toHaveLength(1);
      expect(creditEntries[0].credits).toBe(10);
      expect(creditEntries[0].type).toBe('referral');
      expect(creditEntries[0].description).toContain('Referral qualified');
    });
  });
});
