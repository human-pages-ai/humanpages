import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

describe('Profile API', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'profile@example.com', name: 'Profile User' });
  });

  describe('GET /api/humans/me', () => {
    it('should return current user profile', async () => {
      const response = await authRequest(user.token).get('/api/humans/me');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe('profile@example.com');
      expect(response.body.name).toBe('Profile User');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should include wallets and services in profile', async () => {
      const response = await authRequest(user.token).get('/api/humans/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('wallets');
      expect(response.body).toHaveProperty('services');
      expect(Array.isArray(response.body.wallets)).toBe(true);
      expect(Array.isArray(response.body.services)).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/humans/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/humans/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('PATCH /api/humans/me', () => {
    it('should update user name', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should update bio', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ bio: 'This is my bio' });

      expect(response.status).toBe(200);
      expect(response.body.bio).toBe('This is my bio');
    });

    it('should update location', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ location: 'New York, NY' });

      expect(response.status).toBe(200);
      expect(response.body.location).toBe('New York, NY');
    });

    it('should update skills', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ skills: ['javascript', 'react', 'nodejs'] });

      expect(response.status).toBe(200);
      expect(response.body.skills).toEqual(['javascript', 'react', 'nodejs']);
    });

    it('should update availability', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ isAvailable: false });

      expect(response.status).toBe(200);
      expect(response.body.isAvailable).toBe(false);
    });

    it('should update multiple fields at once', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({
          name: 'Multi Update',
          bio: 'Updated bio',
          location: 'London, UK',
          telegram: '@multiuser',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Multi Update');
      expect(response.body.bio).toBe('Updated bio');
      expect(response.body.location).toBe('London, UK');
      expect(response.body.telegram).toBe('@multiuser');
    });

    it('should reject invalid email format for contactEmail', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ contactEmail: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .patch('/api/humans/me')
        .send({ name: 'Hacker' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/humans/:id', () => {
    it('should return public profile by ID', async () => {
      const response = await request(app).get(`/api/humans/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.name).toBe('Profile User');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('email'); // Public profile shouldn't expose email directly
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/humans/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Human not found');
    });
  });
});
