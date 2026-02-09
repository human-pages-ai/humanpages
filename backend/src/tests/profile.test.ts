import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
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

  describe('PATCH /api/humans/me - Social URLs', () => {
    it('should accept valid LinkedIn URL', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ linkedinUrl: 'https://linkedin.com/in/testuser' });
      expect(response.status).toBe(200);
      expect(response.body.linkedinUrl).toBe('https://linkedin.com/in/testuser');
    });

    it('should reject non-LinkedIn URL for linkedinUrl', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ linkedinUrl: 'https://notlinkedin.com/profile' });
      expect(response.status).toBe(400);
    });

    it('should accept valid Twitter/X URL', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ twitterUrl: 'https://x.com/testuser' });
      expect(response.status).toBe(200);
      expect(response.body.twitterUrl).toBe('https://x.com/testuser');
    });

    it('should reject invalid domain for twitterUrl', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ twitterUrl: 'https://facebook.com/testuser' });
      expect(response.status).toBe(400);
    });

    it('should accept valid GitHub URL', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ githubUrl: 'https://github.com/testuser' });
      expect(response.status).toBe(200);
      expect(response.body.githubUrl).toBe('https://github.com/testuser');
    });

    it('should accept valid website URL (any domain)', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ websiteUrl: 'https://my-custom-site.dev' });
      expect(response.status).toBe(200);
      expect(response.body.websiteUrl).toBe('https://my-custom-site.dev');
    });
  });

  describe('PATCH /api/humans/me - Additional Fields', () => {
    it('should update username (valid alphanumeric)', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ username: 'testuser123' });
      expect(response.status).toBe(200);
      expect(response.body.username).toBe('testuser123');
    });

    it('should reject duplicate username', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await authRequest(otherUser.token)
        .patch('/api/humans/me')
        .send({ username: 'taken_name' });

      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ username: 'taken_name' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username already taken');
    });

    it('should reject invalid username format (special chars)', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ username: 'bad@user!' });
      expect(response.status).toBe(400);
    });

    it('should update equipment array', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ equipment: ['camera', 'drone'] });
      expect(response.status).toBe(200);
      expect(response.body.equipment).toEqual(['camera', 'drone']);
    });

    it('should update languages array', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ languages: ['english', 'spanish'] });
      expect(response.status).toBe(200);
      expect(response.body.languages).toEqual(['english', 'spanish']);
    });

    it('should update location coordinates', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ locationLat: 37.7749, locationLng: -122.4194 });
      expect(response.status).toBe(200);
      expect(response.body.locationLat).toBeCloseTo(37.7749);
      expect(response.body.locationLng).toBeCloseTo(-122.4194);
    });

    it('should update rateType and paymentPreference', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ rateType: 'HOURLY', paymentPreference: 'ESCROW' });
      expect(response.status).toBe(200);
      expect(response.body.rateType).toBe('HOURLY');
      expect(response.body.paymentPreference).toBe('ESCROW');
    });
  });

  describe('PATCH /api/humans/me - WhatsApp validation', () => {
    it('should accept valid WhatsApp number with country code', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '+14155551234' });
      expect(response.status).toBe(200);
      expect(response.body.whatsapp).toBe('+14155551234');
    });

    it('should accept valid international WhatsApp number', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '+442071234567' });
      expect(response.status).toBe(200);
      expect(response.body.whatsapp).toBe('+442071234567');
    });

    it('should reject WhatsApp number without country code', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '4155551234' });
      expect(response.status).toBe(400);
    });

    it('should reject WhatsApp number that is too short', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '+123' });
      expect(response.status).toBe(400);
    });

    it('should reject WhatsApp number with letters', async () => {
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '+1abc5551234' });
      expect(response.status).toBe(400);
    });

    it('should accept null to clear WhatsApp number', async () => {
      // First set a number
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: '+14155551234' });

      // Then clear it
      const response = await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ whatsapp: null });
      expect(response.status).toBe(200);
      expect(response.body.whatsapp).toBeNull();
    });
  });

  describe('DELETE /api/humans/me', () => {
    it('should delete account with correct password', async () => {
      const response = await authRequest(user.token)
        .delete('/api/humans/me')
        .send({ password: 'password123' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify user is gone
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human).toBeNull();
    });

    it('should return 400 without password', async () => {
      const response = await authRequest(user.token).delete('/api/humans/me');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password required to delete account');
    });

    it('should return 401 with wrong password', async () => {
      const response = await authRequest(user.token)
        .delete('/api/humans/me')
        .send({ password: 'wrongpassword' });
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Incorrect password');
    });
  });

  describe('GET /api/humans/me/export', () => {
    it('should return full user data without sensitive fields', async () => {
      const response = await authRequest(user.token).get('/api/humans/me/export');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('emailVerificationToken');
      expect(response.body).not.toHaveProperty('tokenInvalidatedAt');
    });
  });

  describe('GET /api/humans/u/:username', () => {
    it('should return profile by username', async () => {
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ username: 'profileuser' });

      const response = await request(app).get('/api/humans/u/profileuser');
      expect(response.status).toBe(200);
      expect(response.body.username).toBe('profileuser');
      expect(response.body.name).toBe('Profile User');
    });

    it('should return 404 for non-existent username', async () => {
      const response = await request(app).get('/api/humans/u/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Human not found');
    });
  });
});
