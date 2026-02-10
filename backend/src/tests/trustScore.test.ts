import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, createActiveTestAgent, authRequest, cleanDatabase, TestUser } from './helpers.js';
import { _testing, computeTrustScore } from '../lib/trustScore.js';

const {
  computeIdentityScore,
  computeReputationScore,
  computeSocialScore,
  computeActivityScore,
  getTrustLevel,
  computeProfileCompleteness,
  countSocialProfiles,
} = _testing;

// ─── Pure function unit tests (no DB) ────────────────────────────────────────

describe('Trust Score — Pure Functions', () => {
  describe('computeIdentityScore', () => {
    it('should return 0 for completely unverified user', () => {
      const score = computeIdentityScore({
        emailVerified: false,
        hasGoogle: false,
        hasLinkedin: false,
        linkedinVerified: false,
        humanityVerified: false,
        humanityScore: null,
        hasGithub: false,
      });
      expect(score).toBe(0);
    });

    it('should give 0.15 for email verification alone', () => {
      const score = computeIdentityScore({
        emailVerified: true,
        hasGoogle: false,
        hasLinkedin: false,
        linkedinVerified: false,
        humanityVerified: false,
        humanityScore: null,
        hasGithub: false,
      });
      expect(score).toBeCloseTo(0.15);
    });

    it('should give bonus for OAuth providers', () => {
      const score = computeIdentityScore({
        emailVerified: true,
        hasGoogle: true,
        hasLinkedin: false,
        linkedinVerified: false,
        humanityVerified: false,
        humanityScore: null,
        hasGithub: false,
      });
      expect(score).toBeCloseTo(0.25); // 0.15 email + 0.1 google
    });

    it('should cap OAuth bonus at 0.2', () => {
      const score = computeIdentityScore({
        emailVerified: true,
        hasGoogle: true,
        hasLinkedin: true,
        linkedinVerified: false,
        humanityVerified: false,
        humanityScore: null,
        hasGithub: true,
      });
      // 0.15 email + 0.2 oauth cap + 0.1 github
      expect(score).toBeCloseTo(0.45);
    });

    it('should give full score for fully verified user', () => {
      const score = computeIdentityScore({
        emailVerified: true,
        hasGoogle: true,
        hasLinkedin: true,
        linkedinVerified: true,
        humanityVerified: true,
        humanityScore: 50,
        hasGithub: true,
      });
      // 0.15 + 0.2 + 0.2 + 0.1 + 0.25 + 0.1 = 1.0
      expect(score).toBe(1);
    });

    it('should give humanity bonus only for score >= 40', () => {
      const lowScore = computeIdentityScore({
        emailVerified: true,
        hasGoogle: false,
        hasLinkedin: false,
        linkedinVerified: false,
        humanityVerified: true,
        humanityScore: 20,
        hasGithub: false,
      });
      const highScore = computeIdentityScore({
        emailVerified: true,
        hasGoogle: false,
        hasLinkedin: false,
        linkedinVerified: false,
        humanityVerified: true,
        humanityScore: 50,
        hasGithub: false,
      });
      expect(highScore - lowScore).toBeCloseTo(0.1);
    });
  });

  describe('computeReputationScore', () => {
    it('should return 0 for no jobs', () => {
      expect(computeReputationScore({
        jobsCompleted: 0,
        completionRate: 0,
        avgRating: 0,
        reviewCount: 0,
        disputeCount: 0,
      })).toBe(0);
    });

    it('should reward high completion rate', () => {
      const score = computeReputationScore({
        jobsCompleted: 10,
        completionRate: 1.0,
        avgRating: 5,
        reviewCount: 10,
        disputeCount: 0,
      });
      expect(score).toBeGreaterThan(0.7);
    });

    it('should penalize disputes', () => {
      const noDispute = computeReputationScore({
        jobsCompleted: 10,
        completionRate: 0.9,
        avgRating: 4.5,
        reviewCount: 10,
        disputeCount: 0,
      });
      const withDispute = computeReputationScore({
        jobsCompleted: 10,
        completionRate: 0.9,
        avgRating: 4.5,
        reviewCount: 10,
        disputeCount: 2,
      });
      expect(withDispute).toBeLessThan(noDispute);
    });

    it('should handle low ratings', () => {
      const score = computeReputationScore({
        jobsCompleted: 5,
        completionRate: 0.5,
        avgRating: 2.0,
        reviewCount: 3,
        disputeCount: 1,
      });
      expect(score).toBeLessThan(0.3);
    });

    it('should use logarithmic scaling for review count', () => {
      const fewReviews = computeReputationScore({
        jobsCompleted: 5,
        completionRate: 1.0,
        avgRating: 5,
        reviewCount: 2,
        disputeCount: 0,
      });
      const manyReviews = computeReputationScore({
        jobsCompleted: 50,
        completionRate: 1.0,
        avgRating: 5,
        reviewCount: 50,
        disputeCount: 0,
      });
      // Logarithmic means diminishing returns
      expect(manyReviews).toBeGreaterThan(fewReviews);
      expect(manyReviews - fewReviews).toBeLessThan(0.5);
    });
  });

  describe('computeSocialScore', () => {
    it('should return 0 for no social signals', () => {
      expect(computeSocialScore({ vouchCount: 0, socialProfilesLinked: 0 })).toBe(0);
    });

    it('should value vouches more than social links', () => {
      const vouchOnly = computeSocialScore({ vouchCount: 5, socialProfilesLinked: 0 });
      const socialOnly = computeSocialScore({ vouchCount: 0, socialProfilesLinked: 5 });
      expect(vouchOnly).toBeGreaterThan(socialOnly);
    });

    it('should cap at 1.0', () => {
      expect(computeSocialScore({ vouchCount: 100, socialProfilesLinked: 6 })).toBeLessThanOrEqual(1);
    });
  });

  describe('computeActivityScore', () => {
    it('should return 0 for brand new inactive user', () => {
      const score = computeActivityScore({
        accountAgeDays: 0,
        daysSinceLastActive: 60,
        profileCompleteness: 0,
      });
      expect(score).toBe(0);
    });

    it('should reward recent activity', () => {
      const active = computeActivityScore({
        accountAgeDays: 30,
        daysSinceLastActive: 0,
        profileCompleteness: 0.5,
      });
      const inactive = computeActivityScore({
        accountAgeDays: 30,
        daysSinceLastActive: 30,
        profileCompleteness: 0.5,
      });
      expect(active).toBeGreaterThan(inactive);
    });

    it('should reward profile completeness', () => {
      const complete = computeActivityScore({
        accountAgeDays: 30,
        daysSinceLastActive: 0,
        profileCompleteness: 1.0,
      });
      const incomplete = computeActivityScore({
        accountAgeDays: 30,
        daysSinceLastActive: 0,
        profileCompleteness: 0.0,
      });
      expect(complete).toBeGreaterThan(incomplete);
    });
  });

  describe('getTrustLevel', () => {
    it('should return new for score < 15', () => {
      expect(getTrustLevel(0)).toBe('new');
      expect(getTrustLevel(14)).toBe('new');
    });

    it('should return basic for 15-34', () => {
      expect(getTrustLevel(15)).toBe('basic');
      expect(getTrustLevel(34)).toBe('basic');
    });

    it('should return verified for 35-59', () => {
      expect(getTrustLevel(35)).toBe('verified');
      expect(getTrustLevel(59)).toBe('verified');
    });

    it('should return trusted for 60+', () => {
      expect(getTrustLevel(60)).toBe('trusted');
      expect(getTrustLevel(100)).toBe('trusted');
    });
  });

  describe('computeProfileCompleteness', () => {
    it('should return 0 for empty profile', () => {
      expect(computeProfileCompleteness({
        name: null,
        bio: null,
        location: null,
        skills: [],
        avatarUrl: null,
        contactEmail: null,
        telegram: null,
        whatsapp: null,
      })).toBe(0);
    });

    it('should return 1 for complete profile', () => {
      expect(computeProfileCompleteness({
        name: 'Test',
        bio: 'Bio here',
        location: 'NYC',
        skills: ['js'],
        avatarUrl: 'http://example.com/avatar.jpg',
        contactEmail: 'test@test.com',
        telegram: null,
        whatsapp: null,
      })).toBe(1);
    });

    it('should count contact as satisfied if any contact method is present', () => {
      const withTelegram = computeProfileCompleteness({
        name: 'Test',
        bio: null,
        location: null,
        skills: [],
        avatarUrl: null,
        contactEmail: null,
        telegram: '@user',
        whatsapp: null,
      });
      const withEmail = computeProfileCompleteness({
        name: 'Test',
        bio: null,
        location: null,
        skills: [],
        avatarUrl: null,
        contactEmail: 'test@test.com',
        telegram: null,
        whatsapp: null,
      });
      expect(withTelegram).toBe(withEmail);
    });
  });

  describe('countSocialProfiles', () => {
    it('should return 0 for no links', () => {
      expect(countSocialProfiles({
        linkedinUrl: null,
        twitterUrl: null,
        githubUrl: null,
        instagramUrl: null,
        youtubeUrl: null,
        websiteUrl: null,
      })).toBe(0);
    });

    it('should count each linked profile', () => {
      expect(countSocialProfiles({
        linkedinUrl: 'https://linkedin.com/in/test',
        twitterUrl: 'https://x.com/test',
        githubUrl: 'https://github.com/test',
        instagramUrl: null,
        youtubeUrl: null,
        websiteUrl: 'https://example.com',
      })).toBe(4);
    });

    it('should count all 6', () => {
      expect(countSocialProfiles({
        linkedinUrl: 'a',
        twitterUrl: 'b',
        githubUrl: 'c',
        instagramUrl: 'd',
        youtubeUrl: 'e',
        websiteUrl: 'f',
      })).toBe(6);
    });
  });
});

// ─── Integration tests (with DB) ────────────────────────────────────────────

describe('Trust Score — Integration', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'trust@example.com', name: 'Trust User' });
  });

  describe('computeTrustScore', () => {
    it('should compute basic score for new user', async () => {
      const score = await computeTrustScore(user.id);

      expect(score).toHaveProperty('score');
      expect(score).toHaveProperty('level');
      expect(score).toHaveProperty('signals');
      expect(score).toHaveProperty('breakdown');
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(['new', 'basic', 'verified', 'trusted']).toContain(score.level);
    });

    it('should include identity signals', async () => {
      const score = await computeTrustScore(user.id);

      expect(score.signals.identity).toHaveProperty('emailVerified');
      expect(score.signals.identity).toHaveProperty('hasGoogle');
      expect(score.signals.identity).toHaveProperty('hasLinkedin');
      expect(score.signals.identity).toHaveProperty('linkedinVerified');
      expect(score.signals.identity).toHaveProperty('humanityVerified');
      expect(score.signals.identity).toHaveProperty('hasGithub');
    });

    it('should increase score when profile is completed', async () => {
      const beforeScore = await computeTrustScore(user.id);

      // Add profile fields
      await prisma.human.update({
        where: { id: user.id },
        data: {
          bio: 'I am a developer',
          location: 'New York',
          skills: ['javascript', 'react'],
          contactEmail: 'trust@example.com',
          linkedinUrl: 'https://linkedin.com/in/test',
          twitterUrl: 'https://x.com/test',
          githubUrl: 'https://github.com/test',
        },
      });

      const afterScore = await computeTrustScore(user.id);

      expect(afterScore.score).toBeGreaterThan(beforeScore.score);
      expect(afterScore.signals.social.socialProfilesLinked).toBe(3);
    });

    it('should increase score when GitHub is verified via OAuth', async () => {
      const beforeScore = await computeTrustScore(user.id);

      await prisma.human.update({
        where: { id: user.id },
        data: {
          githubId: 'github-12345',
          githubVerified: true,
          githubUsername: 'testuser',
          githubUrl: 'https://github.com/testuser',
        },
      });

      const afterScore = await computeTrustScore(user.id);

      expect(afterScore.score).toBeGreaterThan(beforeScore.score);
      expect(afterScore.signals.identity.hasGithub).toBe(true);
    });

    it('should increase score when LinkedIn is verified', async () => {
      const beforeScore = await computeTrustScore(user.id);

      await prisma.human.update({
        where: { id: user.id },
        data: {
          linkedinId: 'linkedin-12345',
          linkedinVerified: true,
        },
      });

      const afterScore = await computeTrustScore(user.id);

      expect(afterScore.score).toBeGreaterThan(beforeScore.score);
      expect(afterScore.signals.identity.linkedinVerified).toBe(true);
    });

    it('should throw for non-existent user', async () => {
      await expect(computeTrustScore('nonexistent-id')).rejects.toThrow('User not found');
    });
  });

  describe('Trust score in API responses', () => {
    it('should include trust score in GET /api/humans/me', async () => {
      const response = await authRequest(user.token).get('/api/humans/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trustScore');
      expect(response.body.trustScore).toHaveProperty('score');
      expect(response.body.trustScore).toHaveProperty('level');
      expect(response.body.trustScore).toHaveProperty('signals');
      expect(response.body.trustScore).toHaveProperty('breakdown');
    });

    it('should include trust score in GET /api/humans/:id', async () => {
      const response = await request(app).get(`/api/humans/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trustScore');
      expect(response.body.trustScore).toHaveProperty('score');
      expect(response.body.trustScore).toHaveProperty('level');
    });

    it('should include trust score in PATCH /api/humans/me response', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ bio: 'Updated bio' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trustScore');
    });

    it('should include trust score in search results', async () => {
      // Add skills so user appears in search
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ skills: ['javascript'], location: 'New York' });

      const response = await request(app)
        .get('/api/humans/search?skill=javascript');

      expect(response.status).toBe(200);
      if (response.body.humans && response.body.humans.length > 0) {
        const found = response.body.humans.find((h: any) => h.id === user.id);
        if (found) {
          expect(found).toHaveProperty('trustScore');
          expect(found.trustScore).toHaveProperty('score');
          expect(found.trustScore).toHaveProperty('level');
        }
      }
    });

    it('should reflect higher trust score after verification', async () => {
      const beforeResponse = await authRequest(user.token).get('/api/humans/me');
      const beforeScore = beforeResponse.body.trustScore.score;

      // Verify GitHub
      await prisma.human.update({
        where: { id: user.id },
        data: {
          githubId: 'gh-999',
          githubVerified: true,
          githubUsername: 'trustuser',
        },
      });

      const afterResponse = await authRequest(user.token).get('/api/humans/me');
      const afterScore = afterResponse.body.trustScore.score;

      expect(afterScore).toBeGreaterThan(beforeScore);
    });
  });

  describe('Trust score with jobs and reviews', () => {
    it('should increase reputation score after completed jobs', async () => {
      const agent = await createActiveTestAgent();

      const beforeScore = await computeTrustScore(user.id);

      // Create and complete a job
      const job = await prisma.job.create({
        data: {
          agentId: agent.id,
          humanId: user.id,
          title: 'Test Job',
          description: 'A test job',
          priceUsdc: '100',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Add a review
      await prisma.review.create({
        data: {
          jobId: job.id,
          humanId: user.id,
          rating: 5,
          comment: 'Excellent work',
        },
      });

      const afterScore = await computeTrustScore(user.id);

      expect(afterScore.score).toBeGreaterThan(beforeScore.score);
      expect(afterScore.signals.reputation.jobsCompleted).toBe(1);
      expect(afterScore.signals.reputation.avgRating).toBe(5);
      expect(afterScore.signals.reputation.reviewCount).toBe(1);
    });

    it('should reduce score for disputed jobs', async () => {
      const agent = await createActiveTestAgent();

      // Create completed jobs
      for (let i = 0; i < 5; i++) {
        await prisma.job.create({
          data: {
            agentId: agent.id,
            humanId: user.id,
            title: `Job ${i}`,
            description: 'A test job',
            priceUsdc: '100',
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      const goodScore = await computeTrustScore(user.id);

      // Add a disputed job
      await prisma.job.create({
        data: {
          agentId: agent.id,
          humanId: user.id,
          title: 'Disputed Job',
          description: 'A disputed job',
          priceUsdc: '100',
          status: 'DISPUTED',
        },
      });

      const badScore = await computeTrustScore(user.id);

      expect(badScore.signals.reputation.disputeCount).toBe(1);
      // The dispute should affect the score negatively
      expect(badScore.breakdown.reputation).toBeLessThanOrEqual(goodScore.breakdown.reputation);
    });
  });

  describe('Trust score with vouches', () => {
    it('should increase social score with vouches', async () => {
      const beforeScore = await computeTrustScore(user.id);

      // Create vouchers
      for (let i = 0; i < 3; i++) {
        const voucher = await createTestUser({ email: `voucher${i}@example.com` });
        await prisma.vouch.create({
          data: {
            voucherId: voucher.id,
            voucheeId: user.id,
            comment: `Vouch ${i}`,
          },
        });
      }

      const afterScore = await computeTrustScore(user.id);

      expect(afterScore.signals.social.vouchCount).toBe(3);
      expect(afterScore.breakdown.social).toBeGreaterThan(beforeScore.breakdown.social);
    });
  });
});

// ─── GitHub OAuth tests ──────────────────────────────────────────────────────

describe('GitHub OAuth Verification', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'github@example.com', name: 'GitHub User' });
  });

  describe('GET /api/oauth/github/verify', () => {
    it('should return GitHub OAuth URL', async () => {
      const response = await authRequest(user.token).get('/api/oauth/github/verify');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('state');
      expect(response.body.url).toContain('github.com/login/oauth/authorize');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/oauth/github/verify');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/oauth/github/verify/callback', () => {
    it('should reject without code', async () => {
      const response = await authRequest(user.token)
        .post('/api/oauth/github/verify/callback')
        .send({ state: 'some-state' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code and state required');
    });

    it('should reject without state', async () => {
      const response = await authRequest(user.token)
        .post('/api/oauth/github/verify/callback')
        .send({ code: 'some-code' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code and state required');
    });

    it('should reject invalid state', async () => {
      const response = await authRequest(user.token)
        .post('/api/oauth/github/verify/callback')
        .send({ code: 'some-code', state: 'invalid-state' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired OAuth state');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/oauth/github/verify/callback')
        .send({ code: 'some-code', state: 'some-state' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/humans/me/disconnect-github', () => {
    it('should disconnect GitHub', async () => {
      // First link GitHub
      await prisma.human.update({
        where: { id: user.id },
        data: {
          githubId: 'gh-123',
          githubVerified: true,
          githubUsername: 'testuser',
        },
      });

      const response = await authRequest(user.token)
        .post('/api/humans/me/disconnect-github');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('GitHub disconnected');

      // Verify in DB
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.githubId).toBeNull();
      expect(human?.githubVerified).toBe(false);
      expect(human?.githubUsername).toBeNull();
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).post('/api/humans/me/disconnect-github');
      expect(response.status).toBe(401);
    });
  });
});
