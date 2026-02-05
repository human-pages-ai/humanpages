import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, cleanDatabase } from './helpers.js';

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
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('human');
      expect(response.body).toHaveProperty('token');
      expect(response.body.human.email).toBe('newuser@example.com');
      expect(response.body.human.name).toBe('New User');
      expect(response.body.human).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Another User',
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
  });
});
