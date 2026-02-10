import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, authRequest, createTestUserWithProfile } from './helpers.js';

describe('Referral Program API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ===== Auto-creation of affiliate records =====
  describe('Auto-creation of referral records', () => {
    it('should auto-create affiliate record when recording a referral', async () => {
      const { recordAffiliateReferral } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'referrer@test.com', name: 'Referrer' });
      const referred = await createTestUser({ email: 'referred@test.com', name: 'Referred' });

      // No affiliate record yet
      let affiliate = await prisma.affiliate.findUnique({ where: { humanId: referrer.id } });
      expect(affiliate).toBeNull();

      // Record referral — should auto-create affiliate record
      await recordAffiliateReferral(referrer.id, referred.id);

      affiliate = await prisma.affiliate.findUnique({
        where: { humanId: referrer.id },
        include: { referrals: true },
      });

      expect(affiliate).not.toBeNull();
      expect(affiliate!.status).toBe('APPROVED');
      expect(affiliate!.totalSignups).toBe(1);
      expect(affiliate!.referrals).toHaveLength(1);
      expect(affiliate!.referrals[0].referredHumanId).toBe(referred.id);
    });

    it('should use existing affiliate record if already created', async () => {
      const { recordAffiliateReferral, getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'referrer2@test.com' });
      const referred1 = await createTestUser({ email: 'ref1@test.com' });
      const referred2 = await createTestUser({ email: 'ref2@test.com' });

      // Pre-create affiliate record
      const existingAffiliate = await getOrCreateAffiliate(referrer.id);

      await recordAffiliateReferral(referrer.id, referred1.id);
      await recordAffiliateReferral(referrer.id, referred2.id);

      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: referrer.id },
        include: { referrals: true },
      });

      expect(affiliate!.id).toBe(existingAffiliate.id);
      expect(affiliate!.totalSignups).toBe(2);
      expect(affiliate!.referrals).toHaveLength(2);
    });
  });

  // ===== Referral recording via signup =====
  describe('Referral recording via signup', () => {
    it('should record referral when signup uses referrer ID', async () => {
      const referrer = await createTestUser({ email: 'referrer@test.com', name: 'Referrer' });

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
          referrerId: referrer.id,
          termsAccepted: true,
          captchaToken: 'test-token',
        });

      expect(signupRes.status).toBe(201);

      // Wait for async referral recording
      await new Promise((resolve) => setTimeout(resolve, 200));

      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: referrer.id },
        include: { referrals: true },
      });

      expect(affiliate).not.toBeNull();
      expect(affiliate!.totalSignups).toBe(1);
      expect(affiliate!.referrals).toHaveLength(1);
      expect(affiliate!.referrals[0].referredHumanId).toBe(signupRes.body.human.id);
      expect(affiliate!.referrals[0].qualified).toBe(false);
    });

    it('should qualify referral when referred user completes profile', async () => {
      const { recordAffiliateReferral } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'aff@test.com', name: 'Referrer' });

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
          referrerId: referrer.id,
          termsAccepted: true,
          captchaToken: 'test-token',
        });

      const newUserId = signupRes.body.human.id;
      const newUserToken = signupRes.body.token;

      // Wait for async referral recording
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Ensure referral exists
      const existingRef = await prisma.affiliateReferral.findUnique({
        where: { referredHumanId: newUserId },
      });
      if (!existingRef) {
        await recordAffiliateReferral(referrer.id, newUserId);
      }

      // Set referredBy
      await prisma.human.update({
        where: { id: newUserId },
        data: { referredBy: referrer.id },
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

      // Check referral is qualified
      const referral = await prisma.affiliateReferral.findUnique({
        where: { referredHumanId: newUserId },
      });
      expect(referral!.qualified).toBe(true);
      expect(referral!.creditsAwarded).toBe(10);

      // Check affiliate credits
      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: referrer.id },
      });
      expect(affiliate!.qualifiedSignups).toBe(1);
      expect(affiliate!.totalCredits).toBe(10);
    });
  });

  // ===== Profile includes referral program data =====
  describe('Profile includes referral program data', () => {
    it('should return referralProgram: null when user has no referrals', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token).get('/api/humans/me');

      expect(res.status).toBe(200);
      expect(res.body.referralProgram).toBeNull();
    });

    it('should return referralProgram data when user has affiliate record', async () => {
      const { getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const user = await createTestUser();
      await getOrCreateAffiliate(user.id);

      const res = await authRequest(user.token).get('/api/humans/me');

      expect(res.status).toBe(200);
      expect(res.body.referralProgram).toBeDefined();
      expect(res.body.referralProgram.status).toBe('APPROVED');
      expect(res.body.referralProgram.creditsPerReferral).toBe(10);
      expect(res.body.referralProgram.totalSignups).toBe(0);
      expect(res.body.referralProgram.milestones).toHaveLength(3);
      expect(res.body.referralProgram.referrals).toHaveLength(0);
      expect(res.body.referralProgram.creditLedger).toHaveLength(0);
    });
  });

  // ===== GET /api/affiliate/leaderboard =====
  describe('GET /api/affiliate/leaderboard', () => {
    it('should return empty leaderboard when no referrers', async () => {
      const res = await request(app).get('/api/affiliate/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return referrers ranked by qualified signups', async () => {
      const { getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const user1 = await createTestUser({ email: 'top@test.com', name: 'Top Referrer' });
      const user2 = await createTestUser({ email: 'mid@test.com', name: 'Mid Referrer' });

      await getOrCreateAffiliate(user1.id);
      await getOrCreateAffiliate(user2.id);

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
      expect(res.body[0].name).toBe('Top Referrer');
      expect(res.body[0].referrals).toBe(50);
      expect(res.body[1].rank).toBe(2);
      expect(res.body[1].name).toBe('Mid Referrer');
      expect(res.body[1].referrals).toBe(10);
    });

    it('should not include referrers with 0 referrals', async () => {
      const { getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const user = await createTestUser();
      await getOrCreateAffiliate(user.id);

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

      const referrer = await createTestUser({ email: 'aff-fraud@test.com' });
      const referredUser = await createTestUser({ email: 'ref-fraud@test.com' });

      await recordAffiliateReferral(referrer.id, referredUser.id);
      await recordAffiliateReferral(referrer.id, referredUser.id);

      const affiliate = await prisma.affiliate.findUnique({
        where: { humanId: referrer.id },
        include: { referrals: true },
      });

      expect(affiliate!.totalSignups).toBe(1);
      expect(affiliate!.referrals).toHaveLength(1);
    });

    it('should not qualify already qualified referral', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'aff-dupe@test.com' });
      const referredUser = await createTestUser({ email: 'ref-dupe@test.com' });

      await recordAffiliateReferral(referrer.id, referredUser.id);

      // Qualify once
      await qualifyAffiliateReferral(referredUser.id);

      let affiliate = await prisma.affiliate.findUnique({ where: { humanId: referrer.id } });
      const creditsAfterFirst = affiliate!.totalCredits;

      // Qualify again — should not double-count
      await qualifyAffiliateReferral(referredUser.id);

      affiliate = await prisma.affiliate.findUnique({ where: { humanId: referrer.id } });
      expect(affiliate!.totalCredits).toBe(creditsAfterFirst);
      expect(affiliate!.qualifiedSignups).toBe(1);
    });
  });

  // ===== Milestone bonuses =====
  describe('Milestone bonuses', () => {
    it('should award bonus when reaching tier 1 threshold', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral, getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'milestone@test.com' });
      await getOrCreateAffiliate(referrer.id);

      // Simulate 9 qualified referrals
      await prisma.affiliate.update({
        where: { humanId: referrer.id },
        data: { qualifiedSignups: 9, totalCredits: 90 },
      });

      // Create the 10th referral
      const user10 = await createTestUser({ email: 'ref10@test.com' });
      await recordAffiliateReferral(referrer.id, user10.id);

      // Qualify it — should trigger tier 1 bonus
      await qualifyAffiliateReferral(user10.id);

      const credits = await prisma.affiliateCredit.findMany({
        where: {
          affiliate: { humanId: referrer.id },
          type: 'bonus_tier1',
        },
      });

      expect(credits).toHaveLength(1);
      expect(credits[0].credits).toBe(50);
      expect(credits[0].description).toContain('10 qualified');
    });

    it('should not double-award milestone bonus', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral, getOrCreateAffiliate } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'milestone2@test.com' });
      await getOrCreateAffiliate(referrer.id);

      await prisma.affiliate.update({
        where: { humanId: referrer.id },
        data: { qualifiedSignups: 9, totalCredits: 90 },
      });

      const user10 = await createTestUser({ email: 'ref10b@test.com' });
      await recordAffiliateReferral(referrer.id, user10.id);
      await qualifyAffiliateReferral(user10.id);

      let affiliate = await prisma.affiliate.findUnique({ where: { humanId: referrer.id } });
      const creditsAfterBonus = affiliate!.totalCredits;

      // 90 (existing) + 10 (referral) + 50 (bonus) = 150
      expect(creditsAfterBonus).toBe(150);

      const bonusEntries = await prisma.affiliateCredit.findMany({
        where: {
          affiliate: { humanId: referrer.id },
          type: 'bonus_tier1',
        },
      });
      expect(bonusEntries).toHaveLength(1);
    });

    it('should track credits in credit ledger', async () => {
      const { recordAffiliateReferral, qualifyAffiliateReferral } = await import('../routes/affiliate.js');

      const referrer = await createTestUser({ email: 'ledger@test.com' });
      const referredUser = await createTestUser({ email: 'ledgerref@test.com' });

      await recordAffiliateReferral(referrer.id, referredUser.id);
      await qualifyAffiliateReferral(referredUser.id);

      const creditEntries = await prisma.affiliateCredit.findMany({
        where: { affiliate: { humanId: referrer.id } },
      });

      expect(creditEntries).toHaveLength(1);
      expect(creditEntries[0].credits).toBe(10);
      expect(creditEntries[0].type).toBe('referral');
      expect(creditEntries[0].description).toContain('Referral qualified');
    });
  });
});
