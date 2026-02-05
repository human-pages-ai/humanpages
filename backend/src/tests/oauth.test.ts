import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase } from './helpers.js';

// Mock google-auth-library before importing app
vi.mock('google-auth-library', () => {
  const mockClient = {
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true'),
    getToken: vi.fn().mockResolvedValue({
      tokens: { id_token: 'mock-id-token' },
    }),
    verifyIdToken: vi.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-123',
        email: 'googleuser@gmail.com',
        name: 'Google User',
        picture: 'https://example.com/avatar.jpg',
      }),
    }),
  };

  return {
    OAuth2Client: class {
      generateAuthUrl = mockClient.generateAuthUrl;
      getToken = mockClient.getToken;
      verifyIdToken = mockClient.verifyIdToken;
    },
  };
});

// Mock global fetch for GitHub OAuth
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import app after mocks are set up
import app from '../app.js';

describe('OAuth API', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
  });

  describe('GET /api/oauth/google', () => {
    it('should return Google OAuth URL', async () => {
      const response = await request(app).get('/api/oauth/google');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('accounts.google.com');
    });
  });

  describe('POST /api/oauth/google/callback', () => {
    it('should create new user on first Google login', async () => {
      const response = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'mock-auth-code' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.human).toMatchObject({
        email: 'googleuser@gmail.com',
        name: 'Google User',
      });

      // Verify user was created in database
      const user = await prisma.human.findUnique({
        where: { email: 'googleuser@gmail.com' },
      });
      expect(user).not.toBeNull();
      expect(user?.googleId).toBe('google-123');
      expect(user?.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(user?.passwordHash).toBeNull();
    });

    it('should return existing user on subsequent Google login', async () => {
      // First login
      await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'mock-auth-code' });

      // Second login
      const response = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'mock-auth-code' });

      expect(response.status).toBe(200);
      expect(response.body.human.email).toBe('googleuser@gmail.com');

      // Verify only one user exists
      const users = await prisma.human.findMany({
        where: { email: 'googleuser@gmail.com' },
      });
      expect(users.length).toBe(1);
    });

    it('should link Google to existing account with same email', async () => {
      // Create user with password first
      await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'googleuser@gmail.com',
          password: 'password123',
          name: 'Existing User',
        });

      // Login with Google using same email
      const response = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'mock-auth-code' });

      expect(response.status).toBe(200);

      // Verify Google ID was linked to existing account
      const user = await prisma.human.findUnique({
        where: { email: 'googleuser@gmail.com' },
      });
      expect(user?.googleId).toBe('google-123');
      expect(user?.passwordHash).not.toBeNull(); // Password should still exist
    });

    it('should reject request without code', async () => {
      const response = await request(app)
        .post('/api/oauth/google/callback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization code required');
    });
  });

  describe('GET /api/oauth/github', () => {
    it('should return GitHub OAuth URL', async () => {
      const response = await request(app).get('/api/oauth/github');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('github.com/login/oauth/authorize');
    });
  });

  describe('POST /api/oauth/github/callback', () => {
    beforeEach(() => {
      // Mock GitHub token exchange
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve({
            json: () => Promise.resolve({ access_token: 'mock-github-token' }),
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 12345,
              login: 'githubuser',
              name: 'GitHub User',
              avatar_url: 'https://github.com/avatar.jpg',
            }),
          });
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            json: () => Promise.resolve([
              { email: 'githubuser@github.com', primary: true },
            ]),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should create new user on first GitHub login', async () => {
      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-github-code' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.human).toMatchObject({
        email: 'githubuser@github.com',
        name: 'GitHub User',
      });

      // Verify user was created
      const user = await prisma.human.findUnique({
        where: { email: 'githubuser@github.com' },
      });
      expect(user).not.toBeNull();
      expect(user?.githubId).toBe('12345');
      expect(user?.avatarUrl).toBe('https://github.com/avatar.jpg');
    });

    it('should return existing user on subsequent GitHub login', async () => {
      // First login
      await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-github-code' });

      // Second login
      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-github-code' });

      expect(response.status).toBe(200);

      // Verify only one user exists
      const users = await prisma.human.findMany({
        where: { email: 'githubuser@github.com' },
      });
      expect(users.length).toBe(1);
    });

    it('should link GitHub to existing account with same email', async () => {
      // Create user with password first
      await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'githubuser@github.com',
          password: 'password123',
          name: 'Existing User',
        });

      // Login with GitHub using same email
      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-github-code' });

      expect(response.status).toBe(200);

      // Verify GitHub ID was linked
      const user = await prisma.human.findUnique({
        where: { email: 'githubuser@github.com' },
      });
      expect(user?.githubId).toBe('12345');
      expect(user?.passwordHash).not.toBeNull();
    });

    it('should reject request without code', async () => {
      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization code required');
    });

    it('should handle GitHub token error', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve({
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
          }),
        })
      );

      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'invalid-code' });

      expect(response.status).toBe(400);
    });

    it('should use login as name when name is not provided', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve({
            json: () => Promise.resolve({ access_token: 'mock-token' }),
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 99999,
              login: 'noname-user',
              name: null, // No name set
              avatar_url: 'https://github.com/avatar.jpg',
            }),
          });
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            json: () => Promise.resolve([
              { email: 'noname@github.com', primary: true },
            ]),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const response = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-code' });

      expect(response.status).toBe(200);
      expect(response.body.human.name).toBe('noname-user');
    });
  });

  describe('OAuth user can access protected routes', () => {
    it('should allow OAuth user to access profile', async () => {
      // Create user via Google OAuth
      const oauthResponse = await request(app)
        .post('/api/oauth/google/callback')
        .send({ code: 'mock-auth-code' });

      const token = oauthResponse.body.token;

      // Access protected route
      const profileResponse = await request(app)
        .get('/api/humans/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.email).toBe('googleuser@gmail.com');
    });

    it('should allow OAuth user to update profile', async () => {
      // Create user via GitHub OAuth
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve({
            json: () => Promise.resolve({ access_token: 'mock-token' }),
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 55555,
              login: 'updateuser',
              name: 'Update User',
              avatar_url: 'https://github.com/avatar.jpg',
            }),
          });
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            json: () => Promise.resolve([
              { email: 'update@github.com', primary: true },
            ]),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const oauthResponse = await request(app)
        .post('/api/oauth/github/callback')
        .send({ code: 'mock-code' });

      const token = oauthResponse.body.token;

      // Update profile
      const updateResponse = await request(app)
        .patch('/api/humans/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'OAuth user bio' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.bio).toBe('OAuth user bio');
    });
  });
});
