import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, createActiveTestAgent, authRequest } from './helpers.js';

// Mock email module
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

// Cleanup tables relevant to insights
async function cleanInsightsTestData() {
  await prisma.certificate.deleteMany();
  await prisma.education.deleteMany();
  await prisma.agentReport.deleteMany();
  await prisma.humanReport.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.review.deleteMany();
  await prisma.jobMessage.deleteMany();
  await prisma.job.deleteMany();
  await prisma.listingApplication.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.vouch.deleteMany();
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.human.deleteMany();
}

let adminUser: { id: string; email: string; name: string; token: string };

beforeEach(async () => {
  await cleanInsightsTestData();

  const adminEmail = 'admin-insights@example.com';
  process.env.ADMIN_EMAILS = adminEmail;
  adminUser = await createTestUser({ email: adminEmail, name: 'Insights Admin' });
});

describe('Admin Stats — Insights', () => {

  describe('GET /api/admin/stats — insights object', () => {

    it('should include the insights object in the response', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('insights');
      expect(res.body.insights).toHaveProperty('cvUploaded');
      expect(res.body.insights).toHaveProperty('telegramConnected');
      expect(res.body.insights).toHaveProperty('telegramBotSignups');
      expect(res.body.insights).toHaveProperty('education');
      expect(res.body.insights).toHaveProperty('profileCompleteness');
      expect(res.body.insights).toHaveProperty('verification');
      expect(res.body.insights).toHaveProperty('workMode');
      expect(res.body.insights).toHaveProperty('utmSources');
      expect(res.body.insights).toHaveProperty('topSkills');
      // topLocations was removed from the insights API
    });

    it('should return zero counts when no data exists', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const ins = res.body.insights;

      // Only the admin user exists, no CV/TG/UTM data
      expect(ins.cvUploaded).toBe(0);
      expect(ins.telegramConnected).toBe(0);
      expect(ins.telegramBotSignups).toBe(0);
    });
  });

  describe('CV Uploaded', () => {
    it('should count users who have uploaded a CV', async () => {
      // Create users — one with CV, one without
      const userWithCv = await createTestUser({ email: 'cv@example.com', name: 'CV User' });
      await prisma.human.update({
        where: { id: userWithCv.id },
        data: { cvFileKey: 'cvs/user123/abc.pdf' },
      });

      await createTestUser({ email: 'nocv@example.com', name: 'No CV User' });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.cvUploaded).toBe(1);
    });
  });

  describe('Telegram Connected', () => {
    it('should count users with telegramChatId', async () => {
      const tgUser = await createTestUser({ email: 'tg@example.com', name: 'TG User' });
      await prisma.human.update({
        where: { id: tgUser.id },
        data: { telegramChatId: '123456789' },
      });

      const tgUser2 = await createTestUser({ email: 'tg2@example.com', name: 'TG User 2' });
      await prisma.human.update({
        where: { id: tgUser2.id },
        data: { telegramChatId: '987654321' },
      });

      // User without TG
      await createTestUser({ email: 'notg@example.com', name: 'No TG' });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.telegramConnected).toBe(2);
    });
  });

  describe('Telegram Bot Signups (UTM)', () => {
    it('should count users who signed up via telegram_bot UTM source', async () => {
      const tgBotUser = await createTestUser({ email: 'tgbot@example.com', name: 'TG Bot Signup' });
      await prisma.human.update({
        where: { id: tgBotUser.id },
        data: { utmSource: 'telegram_bot' },
      });

      // Different UTM source — should NOT be counted
      const otherUtm = await createTestUser({ email: 'reddit@example.com', name: 'Reddit Signup' });
      await prisma.human.update({
        where: { id: otherUtm.id },
        data: { utmSource: 'reddit' },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.telegramBotSignups).toBe(1);
    });
  });

  describe('Education Breakdown', () => {
    it('should count unique users per education tier', async () => {
      const user1 = await createTestUser({ email: 'edu1@example.com', name: 'Grad Student' });
      const user2 = await createTestUser({ email: 'edu2@example.com', name: 'Undergrad' });
      const user3 = await createTestUser({ email: 'edu3@example.com', name: 'PhD Holder' });

      // User1: has both BA and MA — should count as master's (highest)
      await prisma.education.createMany({
        data: [
          { humanId: user1.id, institution: 'MIT', degree: 'BA', field: 'CS' },
          { humanId: user1.id, institution: 'MIT', degree: 'MSc', field: 'CS' },
        ],
      });

      // User2: only BA — bachelor's
      await prisma.education.create({
        data: { humanId: user2.id, institution: 'Stanford', degree: 'BSc', field: 'Math' },
      });

      // User3: PhD — doctorate
      await prisma.education.create({
        data: { humanId: user3.id, institution: 'Oxford', degree: 'PhD', field: 'Physics' },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const edu = res.body.insights.education;

      expect(edu.doctorate).toBe(1);
      expect(edu.masters).toBe(1);
      expect(edu.bachelors).toBe(1);
    });

    it('should not double-count users with multiple degrees at the same level', async () => {
      const user = await createTestUser({ email: 'multi@example.com', name: 'Multi Degree' });

      // Two bachelor's degrees
      await prisma.education.createMany({
        data: [
          { humanId: user.id, institution: 'MIT', degree: 'BA', field: 'CS' },
          { humanId: user.id, institution: 'Stanford', degree: 'BSc', field: 'Math' },
        ],
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.education.bachelors).toBe(1);
    });

    it('should categorize associate/diploma/certificate as other', async () => {
      const user = await createTestUser({ email: 'cert@example.com', name: 'Cert User' });
      await prisma.education.create({
        data: { humanId: user.id, institution: 'Community College', degree: 'Associate', field: 'Business' },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.education.other).toBe(1);
    });
  });

  describe('Profile Completeness', () => {
    it('should return distribution buckets that sum to total users', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const dist = res.body.insights.profileCompleteness.distribution;

      const sumBuckets = Object.values(dist).reduce((s: number, v) => s + (v as number), 0);
      expect(sumBuckets).toBe(res.body.users.total);
    });

    it('should return all five buckets', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const dist = res.body.insights.profileCompleteness.distribution;

      expect(dist).toHaveProperty('0-19');
      expect(dist).toHaveProperty('20-39');
      expect(dist).toHaveProperty('40-59');
      expect(dist).toHaveProperty('60-79');
      expect(dist).toHaveProperty('80-100');
    });

    it('should return avgScore as a number between 0 and 100', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const avg = res.body.insights.profileCompleteness.avgScore;

      expect(typeof avg).toBe('number');
      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThanOrEqual(100);
    });

    it('should count users with bio, photo, service, education, skills, location', async () => {
      const user = await createTestUser({ email: 'complete@example.com', name: 'Complete User' });
      await prisma.human.update({
        where: { id: user.id },
        data: {
          bio: 'I am a developer',
          profilePhotoStatus: 'approved',
          skills: ['React', 'TypeScript'],
          location: 'New York',
        },
      });
      await prisma.service.create({
        data: { humanId: user.id, title: 'Web Dev', description: 'I build websites', category: 'Development', priceMin: 50 },
      });
      await prisma.education.create({
        data: { humanId: user.id, institution: 'NYU', degree: 'BSc', field: 'CS' },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const pc = res.body.insights.profileCompleteness;

      // At least 1 user has each (could be more from admin user)
      expect(pc.withBio).toBeGreaterThanOrEqual(1);
      expect(pc.withPhoto).toBeGreaterThanOrEqual(1);
      expect(pc.withService).toBeGreaterThanOrEqual(1);
      expect(pc.withEducation).toBeGreaterThanOrEqual(1);
      expect(pc.withSkills).toBeGreaterThanOrEqual(1);
      expect(pc.withLocation).toBeGreaterThanOrEqual(1);
    });

    it('should place a fully empty user in the lowest bucket', async () => {
      // Admin user already exists with emailVerified=true (10 points), so they're in 0-19 or 20-39
      // Create a truly empty user
      const emptyUser = await createTestUser({ email: 'empty@example.com', name: 'Empty User' });
      await prisma.human.update({
        where: { id: emptyUser.id },
        data: { emailVerified: false },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const dist = res.body.insights.profileCompleteness.distribution;

      // The empty user (0 score) should be in the 0-19 bucket
      expect(dist['0-19']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Verification Methods', () => {
    it('should count users by OAuth provider', async () => {
      const googleUser = await createTestUser({ email: 'google@example.com', name: 'Google User' });
      await prisma.human.update({
        where: { id: googleUser.id },
        data: { googleId: 'google-123' },
      });

      const linkedinUser = await createTestUser({ email: 'linkedin@example.com', name: 'LinkedIn User' });
      await prisma.human.update({
        where: { id: linkedinUser.id },
        data: { linkedinVerified: true },
      });

      const githubUser = await createTestUser({ email: 'github@example.com', name: 'GitHub User' });
      await prisma.human.update({
        where: { id: githubUser.id },
        data: { githubVerified: true },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const v = res.body.insights.verification;

      expect(v.google).toBe(1);
      expect(v.linkedin).toBe(1);
      expect(v.github).toBe(1);
    });
  });

  describe('Work Mode', () => {
    it('should count users by work mode', async () => {
      const remote1 = await createTestUser({ email: 'remote1@example.com', name: 'Remote 1' });
      const remote2 = await createTestUser({ email: 'remote2@example.com', name: 'Remote 2' });
      const onsite = await createTestUser({ email: 'onsite@example.com', name: 'Onsite' });
      const hybrid = await createTestUser({ email: 'hybrid@example.com', name: 'Hybrid' });

      await prisma.human.update({ where: { id: remote1.id }, data: { workMode: 'REMOTE' } });
      await prisma.human.update({ where: { id: remote2.id }, data: { workMode: 'REMOTE' } });
      await prisma.human.update({ where: { id: onsite.id }, data: { workMode: 'ONSITE' } });
      await prisma.human.update({ where: { id: hybrid.id }, data: { workMode: 'HYBRID' } });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const wm = res.body.insights.workMode;

      expect(wm.REMOTE).toBe(2);
      expect(wm.ONSITE).toBe(1);
      expect(wm.HYBRID).toBe(1);
    });
  });

  describe('UTM Sources', () => {
    it('should return UTM source breakdown', async () => {
      const u1 = await createTestUser({ email: 'utm1@example.com', name: 'UTM 1' });
      const u2 = await createTestUser({ email: 'utm2@example.com', name: 'UTM 2' });
      const u3 = await createTestUser({ email: 'utm3@example.com', name: 'UTM 3' });

      await prisma.human.update({ where: { id: u1.id }, data: { utmSource: 'telegram_bot' } });
      await prisma.human.update({ where: { id: u2.id }, data: { utmSource: 'telegram_bot' } });
      await prisma.human.update({ where: { id: u3.id }, data: { utmSource: 'reddit' } });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const utm = res.body.insights.utmSources;

      expect(utm.telegram_bot).toBe(2);
      expect(utm.reddit).toBe(1);
    });

    it('should not include users with no UTM source', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const utm = res.body.insights.utmSources;

      // Admin user has no utmSource — should not appear
      expect(Object.keys(utm).length).toBe(0);
    });
  });

  describe('Top Skills', () => {
    it('should return top skills ranked by frequency', async () => {
      const u1 = await createTestUser({ email: 'skill1@example.com', name: 'Skill User 1' });
      const u2 = await createTestUser({ email: 'skill2@example.com', name: 'Skill User 2' });
      const u3 = await createTestUser({ email: 'skill3@example.com', name: 'Skill User 3' });

      await prisma.human.update({ where: { id: u1.id }, data: { skills: ['React', 'TypeScript'] } });
      await prisma.human.update({ where: { id: u2.id }, data: { skills: ['React', 'Python'] } });
      await prisma.human.update({ where: { id: u3.id }, data: { skills: ['React', 'Go'] } });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const skills = res.body.insights.topSkills;

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
      // React appears in all 3 users, should be #1
      expect(skills[0].skill).toBe('React');
      expect(skills[0].count).toBe(3);
    });

    it('should return at most 10 skills', async () => {
      const user = await createTestUser({ email: 'manyskills@example.com', name: 'Many Skills' });
      await prisma.human.update({
        where: { id: user.id },
        data: {
          skills: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
        },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      expect(res.body.insights.topSkills.length).toBeLessThanOrEqual(10);
    });
  });

  // Top Locations section was removed from admin insights API

  describe('Available count', () => {
    it('should count users marked as available', async () => {
      // By default, new users have isAvailable = true
      await createTestUser({ email: 'avail@example.com', name: 'Available' });

      const unavailUser = await createTestUser({ email: 'unavail@example.com', name: 'Unavailable' });
      await prisma.human.update({
        where: { id: unavailUser.id },
        data: { isAvailable: false },
      });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      // Admin user + Available user are both isAvailable=true
      expect(res.body.insights.profileCompleteness.available).toBe(2);
    });
  });

  describe('Response structure completeness', () => {
    it('should also return all legacy stats alongside insights', async () => {
      const res = await authRequest(adminUser.token).get('/api/admin/stats');

      // Core stats are still present
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('jobs');
      expect(res.body).toHaveProperty('reports');
      expect(res.body).toHaveProperty('affiliates');
      expect(res.body).toHaveProperty('feedback');
      expect(res.body).toHaveProperty('humanReports');
      expect(res.body).toHaveProperty('listings');
      expect(res.body).toHaveProperty('timeToFirstJob');
      expect(res.body).toHaveProperty('insights');
    });

    it('should return 403 for non-admin users', async () => {
      const regularUser = await createTestUser({ email: 'nonadmin@example.com', name: 'Regular' });
      const res = await authRequest(regularUser.token).get('/api/admin/stats');
      expect(res.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('Education + profile integration scenario', () => {
    it('should handle a realistic mix of user profiles', async () => {
      // User A: complete profile, PhD, TG connected, CV uploaded, from telegram_bot UTM
      const userA = await createTestUser({ email: 'a@example.com', name: 'User A' });
      await prisma.human.update({
        where: { id: userA.id },
        data: {
          bio: 'Expert researcher',
          profilePhotoStatus: 'approved',
          skills: ['Machine Learning', 'Python'],
          location: 'San Francisco',
          telegramChatId: '111',
          cvFileKey: 'cvs/a/cv.pdf',
          utmSource: 'telegram_bot',
          googleId: 'google-a',
          workMode: 'REMOTE',
        },
      });
      await prisma.education.create({ data: { humanId: userA.id, institution: 'Stanford', degree: 'PhD', field: 'AI' } });
      await prisma.service.create({ data: { humanId: userA.id, title: 'ML Consulting', description: 'desc', category: 'Consulting', priceMin: 200 } });

      // User B: partial profile, BSc, no TG
      const userB = await createTestUser({ email: 'b@example.com', name: 'User B' });
      await prisma.human.update({
        where: { id: userB.id },
        data: {
          skills: ['JavaScript'],
          location: 'Lagos, Nigeria',
          utmSource: 'reddit',
          workMode: 'HYBRID',
        },
      });
      await prisma.education.create({ data: { humanId: userB.id, institution: 'UNILAG', degree: 'BSc', field: 'CS' } });

      // User C: empty profile
      await createTestUser({ email: 'c@example.com', name: 'User C' });

      const res = await authRequest(adminUser.token).get('/api/admin/stats');
      const ins = res.body.insights;

      // 4 total users (admin + A + B + C)
      expect(res.body.users.total).toBe(4);

      // CV: only User A
      expect(ins.cvUploaded).toBe(1);

      // TG: only User A
      expect(ins.telegramConnected).toBe(1);

      // TG bot signup: only User A
      expect(ins.telegramBotSignups).toBe(1);

      // Education: 1 doctorate (A), 1 bachelor (B)
      expect(ins.education.doctorate).toBe(1);
      expect(ins.education.bachelors).toBe(1);

      // Verification: 1 Google (A)
      expect(ins.verification.google).toBe(1);

      // Work mode: 1 remote (A), 1 hybrid (B)
      expect(ins.workMode.REMOTE).toBe(1);
      expect(ins.workMode.HYBRID).toBe(1);

      // UTM: telegram_bot=1, reddit=1
      expect(ins.utmSources.telegram_bot).toBe(1);
      expect(ins.utmSources.reddit).toBe(1);

      // Top skills should include Machine Learning, Python, JavaScript
      const skillNames = ins.topSkills.map((s: any) => s.skill);
      expect(skillNames).toContain('Machine Learning');
      expect(skillNames).toContain('Python');
      expect(skillNames).toContain('JavaScript');

      // Profile completeness distribution should sum to 4
      const distSum = Object.values(ins.profileCompleteness.distribution).reduce((s: number, v) => s + (v as number), 0);
      expect(distSum).toBe(4);
    });
  });
});
