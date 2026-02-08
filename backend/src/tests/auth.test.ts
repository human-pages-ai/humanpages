import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, cleanDatabase, authRequest } from './helpers.js';

beforeEach(async () => {
  await cleanDatabase();
});

describe('Auth API', () => {
  describe('POST /api/auth/signup', () => {
    it('should create a new user and return token', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
          termsAccepted: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('human');
      expect(response.body).toHaveProperty('token');
      expect(response.body.human.email).toBe('newuser@example.com');
      expect(response.body.human.name).toBe('New User');
      expect(response.body.human).not.toHaveProperty('passwordHash');
    });

    it('should reject signup without accepting terms', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'noterms@example.com',
          password: 'password123',
          name: 'No Terms User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Another User',
          termsAccepted: true,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'password123',
          name: 'Test User',
          termsAccepted: true,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject password shorter than 6 characters', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: '12345',
          name: 'Test User',
          termsAccepted: true,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: '',
          termsAccepted: true,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login existing user and return token', async () => {
      await createTestUser({ email: 'login@example.com', password: 'mypassword' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'mypassword',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('human');
      expect(response.body).toHaveProperty('token');
      expect(response.body.human.email).toBe('login@example.com');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject wrong password', async () => {
      await createTestUser({ email: 'wrongpw@example.com', password: 'correctpassword' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpw@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login for OAuth-only user (no password)', async () => {
      // Create OAuth-only user directly in DB
      await prisma.human.create({
        data: {
          email: 'oauthonly@example.com',
          name: 'OAuth Only User',
          googleId: 'google-oauth-only-123',
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'oauthonly@example.com',
          password: 'anypassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Please use social login for this account');
    });
  });

  describe('Token-based auth access', () => {
    it('should return valid JWT that can access protected routes', async () => {
      const user = await createTestUser({ email: 'tokentest@example.com' });

      const profileResponse = await authRequest(user.token).get('/api/humans/me');

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.email).toBe('tokentest@example.com');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should invalidate tokens after logout-all', async () => {
      const user = await createTestUser({ email: 'logoutall@example.com' });

      // Verify token works before logout
      const beforeResponse = await authRequest(user.token).get('/api/humans/me');
      expect(beforeResponse.status).toBe(200);

      // Logout from all devices
      const logoutResponse = await authRequest(user.token).post('/api/auth/logout-all');
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logged out from all devices');

      // Wait a moment so the new token timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Old token should now be rejected
      const afterResponse = await authRequest(user.token).get('/api/humans/me');
      expect([401, 403]).toContain(afterResponse.status);
    });
  });
});
