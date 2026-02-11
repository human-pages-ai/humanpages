import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, cleanDatabase, authRequest, loginUser } from './helpers.js';

vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

beforeEach(async () => {
  await cleanDatabase();
});

describe('Account lifecycle', () => {
  describe('Data export with populated profile', () => {
    it('should include services, skills, social links and exclude sensitive fields', async () => {
      const user = await createTestUser({ email: 'export@example.com', name: 'Export User' });

      // Populate profile with skills and social links
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({
          skills: ['javascript', 'react'],
          linkedinUrl: 'https://linkedin.com/in/exportuser',
          githubUrl: 'https://github.com/exportuser',
          bio: 'Full-stack developer',
        });

      // Add a service
      await authRequest(user.token)
        .post('/api/services')
        .send({ title: 'Web Development', description: 'Building web apps', category: 'development' });

      const response = await authRequest(user.token).get('/api/humans/me/export');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body.skills).toEqual(['javascript', 'react']);
      expect(response.body.linkedinUrl).toBe('https://linkedin.com/in/exportuser');
      expect(response.body.githubUrl).toBe('https://github.com/exportuser');
      expect(response.body.bio).toBe('Full-stack developer');
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].title).toBe('Web Development');

      // Sensitive fields must be excluded
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('emailVerificationToken');
      expect(response.body).not.toHaveProperty('tokenInvalidatedAt');
    });
  });

  describe('Account deletion prevents login', () => {
    it('should reject login and invalidate old JWT after account deletion', async () => {
      const email = 'delete-me@example.com';
      const password = 'password123';
      const user = await createTestUser({ email, password });

      // Delete account
      const deleteRes = await authRequest(user.token)
        .delete('/api/humans/me')
        .send({ password });
      expect(deleteRes.status).toBe(200);

      // Login should fail
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password, captchaToken: 'test-token' });
      expect(loginRes.status).toBe(401);

      // Old JWT should be rejected on protected routes
      const meRes = await authRequest(user.token).get('/api/humans/me');
      expect([401, 403, 404]).toContain(meRes.status);
    });
  });

  describe('Offer filters', () => {
    it('should persist minOfferPrice and maxOfferDistance via PATCH + GET', async () => {
      const user = await createTestUser({ email: 'filters@example.com' });

      const patchRes = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ minOfferPrice: 50, maxOfferDistance: 100 });
      expect(patchRes.status).toBe(200);

      const getRes = await authRequest(user.token).get('/api/humans/me');
      expect(getRes.status).toBe(200);
      expect(Number(getRes.body.minOfferPrice)).toBe(50);
      expect(getRes.body.maxOfferDistance).toBe(100);
    });

    it('should clear offer filters by setting to null', async () => {
      const user = await createTestUser({ email: 'clear-filters@example.com' });

      // Set filters first
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ minOfferPrice: 50, maxOfferDistance: 100 });

      // Clear them
      const patchRes = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ minOfferPrice: null, maxOfferDistance: null });
      expect(patchRes.status).toBe(200);

      const getRes = await authRequest(user.token).get('/api/humans/me');
      expect(getRes.status).toBe(200);
      expect(getRes.body.minOfferPrice).toBeNull();
      expect(getRes.body.maxOfferDistance).toBeNull();
    });
  });
});
