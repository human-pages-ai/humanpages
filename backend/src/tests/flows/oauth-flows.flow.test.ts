/**
 * Integration Test: OAuth Flows
 *
 * Tests the OAuth state management and callback flows:
 *   1. Generate OAuth state for Google
 *   2. Generate OAuth state for LinkedIn
 *   3. Verify state expiry
 *   4. Verify state is consumed (replay prevention)
 *   5. LinkedIn verification flow for existing user
 *   6. GitHub verification flow for existing user
 *   7. Disconnect LinkedIn
 *   8. Disconnect GitHub
 *
 * Note: Actual OAuth provider APIs (Google, LinkedIn, GitHub) are external
 * and cannot be tested end-to-end without mocking. We test the state
 * management, account linking logic, and verification endpoints.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { cleanDatabase, createTestUser, authRequest, TestUser } from '../helpers.js';

// Mock email module
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

let user: TestUser;

beforeEach(async () => {
  await cleanDatabase();
  user = await createTestUser({ email: 'oauth-test@example.com', name: 'OAuth User' });
});

describe('Flow: OAuth — State Management & Verification', () => {

  describe('OAuth State Generation', () => {
    it('should generate Google OAuth URL and state', async () => {
      const res = await request(app).get('/api/oauth/google');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.state).toBeDefined();

      // State should be stored in DB
      const stateRecord = await prisma.oAuthState.findUnique({
        where: { token: res.body.state },
      });
      expect(stateRecord).not.toBeNull();
      expect(stateRecord!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate LinkedIn OAuth URL and state', async () => {
      const res = await request(app).get('/api/oauth/linkedin');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.state).toBeDefined();

      const stateRecord = await prisma.oAuthState.findUnique({
        where: { token: res.body.state },
      });
      expect(stateRecord).not.toBeNull();
    });
  });

  describe('OAuth State Validation', () => {
    it('should reject Google callback with invalid state', async () => {
      const res = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'fake-code', state: 'invalid-state' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid or expired');
    });

    it('should reject LinkedIn callback with invalid state', async () => {
      const res = await request(app)
        .post('/api/oauth/linkedin/callback')
        .send({ code: 'fake-code', state: 'invalid-state' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid or expired');
    });

    it('should reject expired OAuth state', async () => {
      // Create an already-expired state
      const expiredState = 'expired-state-token';
      await prisma.oAuthState.create({
        data: {
          token: expiredState,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        },
      });

      const res = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'fake-code', state: expiredState });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid or expired');
    });

    it('should reject callback without code or termsAccepted', async () => {
      const googleRes = await request(app).get('/api/oauth/google');
      const state = googleRes.body.state;

      const res = await request(app)
        .post('/api/oauth/google/callback')
        .send({ state });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Authorization code required');
    });
  });

  describe('LinkedIn Verification (for existing users)', () => {
    it('should get LinkedIn verify auth URL for authenticated user', async () => {
      const res = await authRequest(user.token).get('/api/oauth/linkedin/verify');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.url).toContain('linkedin.com');
      expect(res.body.state).toBeDefined();
    });

    it('should require auth for LinkedIn verification', async () => {
      const res = await request(app).get('/api/oauth/linkedin/verify');
      expect(res.status).toBe(401);
    });

    it('should reject LinkedIn verify callback with invalid state', async () => {
      const res = await authRequest(user.token)
        .post('/api/oauth/linkedin/verify/callback')
        .send({ code: 'fake', state: 'bad-state' });

      expect(res.status).toBe(403);
    });

    it('should reject LinkedIn verify callback without code', async () => {
      const res = await authRequest(user.token)
        .post('/api/oauth/linkedin/verify/callback')
        .send({ state: 'some-state' });

      expect(res.status).toBe(400);
    });
  });

  describe('GitHub Verification (for existing users)', () => {
    it('should get GitHub verify auth URL for authenticated user', async () => {
      const res = await authRequest(user.token).get('/api/oauth/github/verify');
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.url).toContain('github.com');
      expect(res.body.state).toBeDefined();
    });

    it('should require auth for GitHub verification', async () => {
      const res = await request(app).get('/api/oauth/github/verify');
      expect(res.status).toBe(401);
    });

    it('should reject GitHub verify callback with invalid state', async () => {
      const res = await authRequest(user.token)
        .post('/api/oauth/github/verify/callback')
        .send({ code: 'fake', state: 'bad-state' });

      expect(res.status).toBe(403);
    });
  });

  describe('Disconnect Social Accounts', () => {
    it('should disconnect LinkedIn', async () => {
      // Simulate a linked LinkedIn account
      await prisma.human.update({
        where: { id: user.id },
        data: {
          linkedinId: 'linkedin-123',
          linkedinVerified: true,
          linkedinUrl: 'https://linkedin.com/in/test',
        },
      });

      const disconnectRes = await authRequest(user.token)
        .post('/api/humans/me/disconnect-linkedin');

      expect(disconnectRes.status).toBe(200);
      expect(disconnectRes.body.message).toBe('LinkedIn disconnected');

      // Verify in DB
      const updated = await prisma.human.findUnique({ where: { id: user.id } });
      expect(updated?.linkedinId).toBeNull();
      expect(updated?.linkedinVerified).toBe(false);
      // linkedinUrl should be preserved
      expect(updated?.linkedinUrl).toBe('https://linkedin.com/in/test');
    });

    it('should disconnect GitHub', async () => {
      // Simulate a linked GitHub account
      await prisma.human.update({
        where: { id: user.id },
        data: {
          githubId: 'github-456',
          githubVerified: true,
          githubUsername: 'testuser',
          githubUrl: 'https://github.com/testuser',
        },
      });

      const disconnectRes = await authRequest(user.token)
        .post('/api/humans/me/disconnect-github');

      expect(disconnectRes.status).toBe(200);
      expect(disconnectRes.body.message).toBe('GitHub disconnected');

      // Verify in DB
      const updated = await prisma.human.findUnique({ where: { id: user.id } });
      expect(updated?.githubId).toBeNull();
      expect(updated?.githubVerified).toBe(false);
      expect(updated?.githubUsername).toBeNull();
      // githubUrl should be preserved
      expect(updated?.githubUrl).toBe('https://github.com/testuser');
    });

    it('should require auth for disconnect', async () => {
      const linkedinRes = await request(app).post('/api/humans/me/disconnect-linkedin');
      expect(linkedinRes.status).toBe(401);

      const githubRes = await request(app).post('/api/humans/me/disconnect-github');
      expect(githubRes.status).toBe(401);
    });
  });

  describe('OAuth-only User', () => {
    it('should reject password login for OAuth-only user', async () => {
      // Create user directly with only Google ID (no password)
      await prisma.human.create({
        data: {
          email: 'google-only@example.com',
          name: 'Google Only',
          googleId: 'google-id-123',
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'google-only@example.com',
          password: 'anypassword',
          captchaToken: 'test-token',
        });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.error).toContain('social login');
    });
  });
});
