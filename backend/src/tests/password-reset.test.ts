import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser } from './helpers.js';

describe('Password Reset API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return success message for existing user', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If an account exists, a reset link has been sent');

      // Verify token was created
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com' },
      });
      expect(resetRecord).not.toBeNull();
      expect(resetRecord?.token).toBeDefined();
      expect(resetRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return same message for non-existent user (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If an account exists, a reset link has been sent');

      // Verify no token was created
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'nonexistent@example.com' },
      });
      expect(resetRecord).toBeNull();
    });

    it('should invalidate previous tokens on new request', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      // First request
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const firstToken = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      // Second request
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      // First token should be marked as used
      const updatedFirstToken = await prisma.passwordReset.findUnique({
        where: { id: firstToken!.id },
      });
      expect(updatedFirstToken?.usedAt).not.toBeNull();

      // New token should exist
      const tokens = await prisma.passwordReset.findMany({
        where: { email: 'test@example.com', usedAt: null },
      });
      expect(tokens.length).toBe(1);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const user = await createTestUser({ email: 'test@example.com', password: 'oldpassword' });

      // Request reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      // Reset password
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetRecord!.token, password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password has been reset successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'newpassword123', captchaToken: 'test-token' });

      expect(loginResponse.status).toBe(200);

      // Verify cannot login with old password
      const oldLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'oldpassword', captchaToken: 'test-token' });

      expect(oldLoginResponse.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired reset token');
    });

    it('should reject already used token', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      // Use token once
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetRecord!.token, password: 'newpassword1' });

      // Try to use again
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetRecord!.token, password: 'newpassword2' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Reset token has already been used');
    });

    it('should reject expired token', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      // Create expired token directly
      const expiredToken = await prisma.passwordReset.create({
        data: {
          email: 'test@example.com',
          token: 'expired-token-123',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: expiredToken.token, password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Reset token has expired');
    });

    it('should reject password shorter than 6 characters', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetRecord!.token, password: '12345' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/verify-reset-token', () => {
    it('should return valid: true for valid token', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      const response = await request(app)
        .get(`/api/auth/verify-reset-token?token=${resetRecord!.token}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should return valid: false for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-reset-token?token=invalid-token');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return valid: false for used token', async () => {
      await createTestUser({ email: 'test@example.com', password: 'password123' });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'test@example.com', usedAt: null },
      });

      // Use the token
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetRecord!.token, password: 'newpassword123' });

      // Verify it's now invalid
      const response = await request(app)
        .get(`/api/auth/verify-reset-token?token=${resetRecord!.token}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return valid: false for expired token', async () => {
      const expiredToken = await prisma.passwordReset.create({
        data: {
          email: 'test@example.com',
          token: 'expired-token-verify',
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const response = await request(app)
        .get(`/api/auth/verify-reset-token?token=${expiredToken.token}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return error when token not provided', async () => {
      const response = await request(app)
        .get('/api/auth/verify-reset-token');

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('OAuth user password reset', () => {
    it('should not create reset token for OAuth-only user', async () => {
      // Create OAuth-only user directly
      await prisma.human.create({
        data: {
          email: 'oauth@example.com',
          name: 'OAuth User',
          googleId: 'google-123',
        },
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oauth@example.com' });

      // Should return same message to prevent enumeration
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If an account exists, a reset link has been sent');

      // But no token should be created
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { email: 'oauth@example.com' },
      });
      expect(resetRecord).toBeNull();
    });
  });
});
