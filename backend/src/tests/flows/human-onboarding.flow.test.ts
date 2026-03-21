/**
 * Integration Test: Human Onboarding Flow
 *
 * Simulates the complete journey of a new human user:
 *   1. Sign up with email/password
 *   2. Verify email
 *   3. Login with credentials
 *   4. Complete profile (skills, location, bio, languages, equipment)
 *   5. Set availability and work preferences
 *   6. Set offer filters (min price, max distance)
 *   7. Set notification preferences
 *   8. Add services/freelance offerings
 *   9. View own profile to verify completeness
 *  10. Export own data (GDPR)
 *  11. Delete account (cleanup)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { cleanDatabase, authRequest } from '../helpers.js';

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

describe('Flow: Human Onboarding — Full User Journey', () => {
  const userEmail = 'alice@example.com';
  const userPassword = 'securePassword123';
  const userName = 'Alice Johnson';

  it('should complete full onboarding: signup → verify → profile → services → export → delete', async () => {
    // ─── Step 1: Sign up ───────────────────────────────────────────────
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: userEmail,
        password: userPassword,
        name: userName,
        termsAccepted: true,
        captchaToken: 'test-token',
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.human.email).toBe(userEmail);
    expect(signupRes.body.human.name).toBe(userName);
    expect(signupRes.body.token).toBeDefined();
    const userId = signupRes.body.human.id;
    let token = signupRes.body.token;

    // ─── Step 2: Verify email ──────────────────────────────────────────
    // Simulate: generate verification token and hit the verify endpoint
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.human.update({
      where: { id: userId },
      data: { emailVerificationToken: verificationToken, emailVerified: false },
    });

    const verifyRes = await request(app)
      .get(`/api/auth/verify-email?token=${verificationToken}`);

    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.location).toContain('/email-verified');

    // Confirm DB state
    const verifiedUser = await prisma.human.findUnique({ where: { id: userId } });
    expect(verifiedUser?.emailVerified).toBe(true);
    expect(verifiedUser?.emailVerificationToken).toBeTruthy();

    // ─── Step 3: Login with credentials ────────────────────────────────
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: userPassword, captchaToken: 'test-token' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    token = loginRes.body.token;

    // ─── Step 4: Complete profile ──────────────────────────────────────
    const profileRes = await authRequest(token).patch('/api/humans/me').send({
      bio: 'Experienced photographer and drone operator based in San Francisco.',
      skills: ['photography', 'drone-operation', 'video-editing'],
      equipment: ['DJI Mavic 3', 'Canon R6', 'Tripod'],
      languages: ['English', 'Spanish'],
      location: 'San Francisco, CA',
      locationLat: 37.7749,
      locationLng: -122.4194,
      username: 'alice_photo',
      contactEmail: 'alice.work@example.com',
    });

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.bio).toContain('Experienced photographer');
    expect(profileRes.body.skills).toEqual(['photography', 'drone-operation', 'video-editing']);
    expect(profileRes.body.equipment).toEqual(['DJI Mavic 3', 'Canon R6', 'Tripod']);
    expect(profileRes.body.languages).toEqual(['English', 'Spanish']);
    expect(profileRes.body.username).toBe('alice_photo');

    // ─── Step 5: Set availability and work preferences ─────────────────
    const availabilityRes = await authRequest(token).patch('/api/humans/me').send({
      isAvailable: true,
      workMode: 'HYBRID',
      rateType: 'HOURLY',
      minRateUsdc: 50,
      paymentPreference: 'BOTH',
    });

    expect(availabilityRes.status).toBe(200);
    expect(availabilityRes.body.isAvailable).toBe(true);
    expect(availabilityRes.body.workMode).toBe('HYBRID');
    expect(availabilityRes.body.rateType).toBe('HOURLY');

    // ─── Step 6: Set offer filters ─────────────────────────────────────
    const filtersRes = await authRequest(token).patch('/api/humans/me').send({
      minOfferPrice: 25,
      maxOfferDistance: 100,
    });

    expect(filtersRes.status).toBe(200);

    // ─── Step 7: Set notification preferences ──────────────────────────
    const notifRes = await authRequest(token).patch('/api/humans/me').send({
      emailNotifications: true,
      emailDigestMode: 'DAILY',
    });

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.emailNotifications).toBe(true);
    expect(notifRes.body.emailDigestMode).toBe('DAILY');

    // ─── Step 8: Add social profiles ───────────────────────────────────
    const socialRes = await authRequest(token).patch('/api/humans/me').send({
      linkedinUrl: 'https://linkedin.com/in/alicejohnson',
      githubUrl: 'https://github.com/alicejohnson',
      twitterUrl: 'https://twitter.com/alicejohnson',
      websiteUrl: 'https://alicejohnson.com',
    });

    expect(socialRes.status).toBe(200);
    expect(socialRes.body.linkedinUrl).toBe('https://linkedin.com/in/alicejohnson');

    // ─── Step 9: Add services ──────────────────────────────────────────
    const service1Res = await authRequest(token).post('/api/services').send({
      title: 'Drone Photography',
      description: 'Professional aerial photography for real estate, events, and more.',
      category: 'photography',
      priceMin: 100,
      priceCurrency: 'USD',
      priceUnit: 'FLAT_TASK',
    });

    expect(service1Res.status).toBe(201);
    expect(service1Res.body.title).toBe('Drone Photography');
    const service1Id = service1Res.body.id;

    const service2Res = await authRequest(token).post('/api/services').send({
      title: 'Video Editing',
      description: 'Post-production editing for short-form and long-form content.',
      category: 'video',
      priceMin: 50,
      priceCurrency: 'USD',
      priceUnit: 'HOURLY',
    });

    expect(service2Res.status).toBe(201);

    // Update a service
    const updateServiceRes = await authRequest(token).patch(`/api/services/${service1Id}`).send({
      priceMin: 150,
    });
    expect(updateServiceRes.status).toBe(200);

    // List services
    const listServicesRes = await authRequest(token).get('/api/services');
    expect(listServicesRes.status).toBe(200);
    expect(listServicesRes.body).toHaveLength(2);

    // ─── Step 10: View complete profile ────────────────────────────────
    const meRes = await authRequest(token).get('/api/humans/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(userEmail);
    expect(meRes.body.name).toBe(userName);
    expect(meRes.body.bio).toContain('photographer');
    expect(meRes.body.skills).toHaveLength(3);
    expect(meRes.body.services).toHaveLength(2);
    expect(meRes.body.isAvailable).toBe(true);
    expect(meRes.body.reputation).toBeDefined();
    expect(meRes.body.trustScore).toBeDefined();
    expect(meRes.body.hasPassword).toBe(true);

    // ─── Step 11: Export data (GDPR) ───────────────────────────────────
    const exportRes = await authRequest(token).get('/api/humans/me/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.exportedAt).toBeDefined();
    expect(exportRes.body.email).toBe(userEmail);
    expect(exportRes.body.name).toBe(userName);
    expect(exportRes.body.services).toBeDefined();
    // Should not contain sensitive fields
    expect(exportRes.body).not.toHaveProperty('passwordHash');

    // ─── Step 12: Delete a service ─────────────────────────────────────
    const deleteServiceRes = await authRequest(token).delete(`/api/services/${service1Id}`);
    expect(deleteServiceRes.status).toBe(200);

    const remainingServices = await authRequest(token).get('/api/services');
    expect(remainingServices.body).toHaveLength(1);

    // ─── Step 13: Delete account ───────────────────────────────────────
    const deleteRes = await authRequest(token).delete('/api/humans/me').send({
      password: userPassword,
    });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Account deleted successfully');

    // Confirm user no longer exists
    const deletedUser = await prisma.human.findUnique({ where: { id: userId } });
    expect(deletedUser).toBeNull();
  });

  it('should reject signup with invalid data', async () => {
    // No terms accepted
    const noTerms = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@x.com', password: 'pass123', name: 'Test', captchaToken: 'test' });
    expect(noTerms.status).toBe(400);

    // Invalid email
    const badEmail = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'notvalid', password: 'pass123', name: 'Test', termsAccepted: true, captchaToken: 'test' });
    expect(badEmail.status).toBe(400);

    // Short password
    const shortPw = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@x.com', password: '123', name: 'Test', termsAccepted: true, captchaToken: 'test' });
    expect(shortPw.status).toBe(400);
  });

  it('should validate profile update fields', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'validate@example.com', password: 'pass12345', name: 'Val', termsAccepted: true, captchaToken: 'test-token' });
    const token = signupRes.body.token;

    // Invalid LinkedIn URL
    const badLinkedin = await authRequest(token).patch('/api/humans/me').send({
      linkedinUrl: 'https://facebook.com/someone',
    });
    expect(badLinkedin.status).toBe(400);

    // Invalid Twitter URL
    const badTwitter = await authRequest(token).patch('/api/humans/me').send({
      twitterUrl: 'https://linkedin.com/in/test',
    });
    expect(badTwitter.status).toBe(400);

    // Username too short
    const shortUsername = await authRequest(token).patch('/api/humans/me').send({
      username: 'ab',
    });
    expect(shortUsername.status).toBe(400);
  });

  it('should enforce unique username constraint', async () => {
    const user1Res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'u1@example.com', password: 'pass12345', name: 'User1', termsAccepted: true, captchaToken: 'test-token' });
    const token1 = user1Res.body.token;

    const user2Res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'u2@example.com', password: 'pass12345', name: 'User2', termsAccepted: true, captchaToken: 'test-token' });
    const token2 = user2Res.body.token;

    // User 1 takes the username
    await authRequest(token1).patch('/api/humans/me').send({ username: 'taken_name' });

    // User 2 tries to use the same username
    const dupeRes = await authRequest(token2).patch('/api/humans/me').send({ username: 'taken_name' });
    expect(dupeRes.status).toBe(400);
    expect(dupeRes.body.error).toContain('Username already taken');
  });
});
