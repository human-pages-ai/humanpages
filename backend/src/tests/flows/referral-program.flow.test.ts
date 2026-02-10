/**
 * Integration Test: Referral Program Flow
 *
 * Simulates the complete referral/affiliate journey:
 *   1. User A signs up (the referrer)
 *   2. User B signs up with User A's referral
 *   3. Referral is recorded but NOT yet qualified
 *   4. User B completes their profile (bio + skills + email verified)
 *   5. Referral qualifies → credits awarded to User A
 *   6. Verify referral program data in User A's profile
 *   7. Public leaderboard shows referrer stats
 *   8. Anti-fraud: duplicate referral is ignored
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { cleanDatabase, createTestUser, authRequest, TestUser } from '../helpers.js';
import { recordAffiliateReferral, qualifyAffiliateReferral } from '../../routes/affiliate.js';

// Mock email module
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

beforeEach(async () => {
  await cleanDatabase();
});

describe('Flow: Referral Program — Affiliate Lifecycle', () => {
  let referrer: TestUser;

  beforeEach(async () => {
    // Create the referrer (User A)
    referrer = await createTestUser({ email: 'referrer@example.com', name: 'Alice Referrer' });
    await prisma.human.update({
      where: { id: referrer.id },
      data: {
        emailVerified: true,
        bio: 'Experienced freelancer',
        skills: ['photography'],
      },
    });
  });

  it('should complete full referral flow: signup with referral → qualify → credits awarded', async () => {
    // ─── Step 1: User B signs up with User A as referrer ───────────────
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'referred@example.com',
        password: 'password123',
        name: 'Bob Referred',
        termsAccepted: true,
        captchaToken: 'test-token',
        referrerId: referrer.id,
      });

    expect(signupRes.status).toBe(201);
    const referredId = signupRes.body.human.id;
    const referredToken = signupRes.body.token;

    // Verify referredBy is set in DB
    const referredUser = await prisma.human.findUnique({ where: { id: referredId } });
    expect(referredUser?.referredBy).toBe(referrer.id);

    // ─── Step 2: Record the referral ───────────────────────────────────
    await recordAffiliateReferral(referrer.id, referredId, '1.2.3.4', 'TestAgent/1.0');

    // Verify referral recorded but not qualified
    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: referrer.id },
      include: { referrals: true },
    });

    expect(affiliate).not.toBeNull();
    expect(affiliate!.totalSignups).toBe(1);
    expect(affiliate!.qualifiedSignups).toBe(0);
    expect(affiliate!.referrals).toHaveLength(1);
    expect(affiliate!.referrals[0].qualified).toBe(false);

    // ─── Step 3: User B completes profile ──────────────────────────────
    await prisma.human.update({
      where: { id: referredId },
      data: {
        emailVerified: true,
        bio: 'New freelancer here!',
        skills: ['delivery'],
        referredBy: referrer.id,
      },
    });

    // ─── Step 4: Qualify the referral (triggered by profile completion)──
    await qualifyAffiliateReferral(referredId);

    // ─── Step 5: Verify credits awarded ────────────────────────────────
    const updatedAffiliate = await prisma.affiliate.findUnique({
      where: { humanId: referrer.id },
      include: {
        referrals: true,
        creditLedger: true,
      },
    });

    expect(updatedAffiliate!.qualifiedSignups).toBe(1);
    expect(updatedAffiliate!.totalCredits).toBe(10); // Default credits per referral
    expect(updatedAffiliate!.referrals[0].qualified).toBe(true);
    expect(updatedAffiliate!.referrals[0].creditsAwarded).toBe(10);
    expect(updatedAffiliate!.creditLedger).toHaveLength(1);
    expect(updatedAffiliate!.creditLedger[0].type).toBe('referral');

    // ─── Step 6: Verify referral program data in profile ───────────────
    const profileRes = await authRequest(referrer.token).get('/api/humans/me');
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.referralCount).toBe(1);
    expect(profileRes.body.referralProgram).toBeDefined();
    expect(profileRes.body.referralProgram.qualifiedSignups).toBe(1);
    expect(profileRes.body.referralProgram.totalCredits).toBe(10);
    expect(profileRes.body.referralProgram.availableCredits).toBe(10);
    expect(profileRes.body.referralProgram.milestones).toBeDefined();
    expect(profileRes.body.referralProgram.milestones.length).toBeGreaterThan(0);
    expect(profileRes.body.referralProgram.referrals).toHaveLength(1);
  });

  it('should not double-count duplicate referral', async () => {
    const referred = await createTestUser({ email: 'dupe-ref@example.com', name: 'Dupe Ref' });

    // Record first time
    await recordAffiliateReferral(referrer.id, referred.id);

    // Record again — should be ignored
    await recordAffiliateReferral(referrer.id, referred.id);

    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: referrer.id },
    });
    expect(affiliate!.totalSignups).toBe(1);
  });

  it('should not qualify already-qualified referral', async () => {
    const referred = await createTestUser({ email: 'qualify-twice@example.com', name: 'Qualify Twice' });
    await prisma.human.update({
      where: { id: referred.id },
      data: { referredBy: referrer.id, emailVerified: true, bio: 'Test', skills: ['testing'] },
    });

    await recordAffiliateReferral(referrer.id, referred.id);
    await qualifyAffiliateReferral(referred.id);
    await qualifyAffiliateReferral(referred.id); // Should be no-op

    const affiliate = await prisma.affiliate.findUnique({
      where: { humanId: referrer.id },
    });
    expect(affiliate!.qualifiedSignups).toBe(1);
    expect(affiliate!.totalCredits).toBe(10);
  });

  it('should show leaderboard with top referrers', async () => {
    // Create affiliate with some referrals
    await recordAffiliateReferral(referrer.id, (await createTestUser({ email: 'r1@x.com' })).id);
    await recordAffiliateReferral(referrer.id, (await createTestUser({ email: 'r2@x.com' })).id);

    // Manually set qualifiedSignups for leaderboard
    await prisma.affiliate.update({
      where: { humanId: referrer.id },
      data: { qualifiedSignups: 5, totalCredits: 50 },
    });

    const leaderboardRes = await request(app).get('/api/affiliate/leaderboard');
    expect(leaderboardRes.status).toBe(200);
    expect(leaderboardRes.body).toBeInstanceOf(Array);
    expect(leaderboardRes.body.length).toBeGreaterThanOrEqual(1);

    const topEntry = leaderboardRes.body[0];
    expect(topEntry.name).toBe('Alice Referrer');
    expect(topEntry.referrals).toBe(5);
    expect(topEntry.rank).toBe(1);
  });

  it('should not record referral for suspended affiliate', async () => {
    // Create affiliate and suspend
    const affiliate = await prisma.affiliate.create({
      data: {
        humanId: referrer.id,
        status: 'SUSPENDED',
        suspendedReason: 'Fraudulent activity',
      },
    });

    const referred = await createTestUser({ email: 'suspended-ref@x.com' });
    await recordAffiliateReferral(referrer.id, referred.id);

    const updatedAffiliate = await prisma.affiliate.findUnique({
      where: { humanId: referrer.id },
    });
    expect(updatedAffiliate!.totalSignups).toBe(0);
  });
});
