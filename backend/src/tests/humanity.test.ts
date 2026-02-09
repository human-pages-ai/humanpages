import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, createTestUserWithProfile, authRequest } from './helpers.js';

describe('Humanity Verification', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/humans/me/verify-humanity', () => {
    it('should verify and set humanityVerified=true when score >= 20', async () => {
      const user = await createTestUserWithProfile(
        { emailVerified: true },
      );
      await prisma.wallet.create({
        data: {
          humanId: user.id,
          network: 'ethereum',
          address: '0xabc123',
        },
      });

      // Mock fetch for Gitcoin Passport API
      const originalFetch = global.fetch;
      global.fetch = vi.fn((url: any, opts?: any) => {
        if (typeof url === 'string' && url.includes('passport.xyz')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ score: '32.5', error: null }),
          } as Response);
        }
        return originalFetch(url, opts);
      }) as any;

      // Set env vars
      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xabc123' });

      expect(res.status).toBe(200);
      expect(res.body.humanityVerified).toBe(true);
      expect(res.body.humanityScore).toBe(32.5);
      expect(res.body.humanityProvider).toBe('gitcoin_passport');
      expect(res.body.humanityTier).toBe('silver');
      expect(res.body.humanityVerifiedAt).toBeTruthy();

      // Verify in database
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.humanityVerified).toBe(true);
      expect(human?.humanityScore).toBe(32.5);

      global.fetch = originalFetch;
      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });

    it('should set humanityVerified=false when score < 20 (bronze)', async () => {
      const user = await createTestUserWithProfile(
        { emailVerified: true },
      );
      await prisma.wallet.create({
        data: {
          humanId: user.id,
          network: 'ethereum',
          address: '0xabc123',
        },
      });

      const originalFetch = global.fetch;
      global.fetch = vi.fn((url: any, opts?: any) => {
        if (typeof url === 'string' && url.includes('passport.xyz')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ score: '12.0', error: null }),
          } as Response);
        }
        return originalFetch(url, opts);
      }) as any;

      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xabc123' });

      expect(res.status).toBe(200);
      expect(res.body.humanityVerified).toBe(false);
      expect(res.body.humanityScore).toBe(12.0);
      expect(res.body.humanityTier).toBe('bronze');

      global.fetch = originalFetch;
      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });

    it('should reject if user has no wallets', async () => {
      const user = await createTestUserWithProfile(
        { emailVerified: true },
      );

      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xnonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Wallet address not found');

      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });

    it('should reject if wallet address not owned by user', async () => {
      const user = await createTestUserWithProfile(
        { emailVerified: true },
      );
      await prisma.wallet.create({
        data: {
          humanId: user.id,
          network: 'ethereum',
          address: '0xmine',
        },
      });

      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xsomeoneelse' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Wallet address not found');

      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });

    it('should return correct tier names', async () => {
      const user = await createTestUserWithProfile(
        { emailVerified: true },
      );
      await prisma.wallet.create({
        data: {
          humanId: user.id,
          network: 'ethereum',
          address: '0xabc123',
        },
      });

      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      // Test gold tier
      const originalFetch = global.fetch;
      global.fetch = vi.fn((url: any, opts?: any) => {
        if (typeof url === 'string' && url.includes('passport.xyz')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ score: '55.0', error: null }),
          } as Response);
        }
        return originalFetch(url, opts);
      }) as any;

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xabc123' });

      expect(res.status).toBe(200);
      expect(res.body.humanityTier).toBe('gold');
      expect(res.body.humanityVerified).toBe(true);

      global.fetch = originalFetch;
      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });

    it('should update score and timestamp on re-verification', async () => {
      const user = await createTestUserWithProfile(
        {
          emailVerified: true,
          humanityVerified: true,
          humanityScore: 25,
          humanityProvider: 'gitcoin_passport',
          humanityVerifiedAt: new Date('2026-01-01'),
        },
      );
      await prisma.wallet.create({
        data: {
          humanId: user.id,
          network: 'ethereum',
          address: '0xabc123',
        },
      });

      const originalFetch = global.fetch;
      global.fetch = vi.fn((url: any, opts?: any) => {
        if (typeof url === 'string' && url.includes('passport.xyz')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ score: '45.0', error: null }),
          } as Response);
        }
        return originalFetch(url, opts);
      }) as any;

      process.env.GITCOIN_SCORER_API_KEY = 'test-key';
      process.env.GITCOIN_SCORER_ID = 'test-scorer';

      const res = await authRequest(user.token)
        .post('/api/humans/me/verify-humanity')
        .send({ walletAddress: '0xabc123' });

      expect(res.status).toBe(200);
      expect(res.body.humanityScore).toBe(45.0);
      expect(res.body.humanityTier).toBe('gold');
      expect(new Date(res.body.humanityVerifiedAt).getTime()).toBeGreaterThan(
        new Date('2026-01-01').getTime()
      );

      global.fetch = originalFetch;
      delete process.env.GITCOIN_SCORER_API_KEY;
      delete process.env.GITCOIN_SCORER_ID;
    });
  });

  describe('Public profile endpoints include humanity fields', () => {
    it('should include humanity fields in GET /api/humans/:id', async () => {
      const user = await createTestUserWithProfile({
        emailVerified: true,
        humanityVerified: true,
        humanityScore: 32,
        humanityProvider: 'gitcoin_passport',
        humanityVerifiedAt: new Date(),
      });

      const res = await request(app).get(`/api/humans/${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body.humanityVerified).toBe(true);
      expect(res.body.humanityScore).toBe(32);
      expect(res.body.humanityProvider).toBe('gitcoin_passport');
      expect(res.body.humanityVerifiedAt).toBeTruthy();
    });

    it('should include humanity fields in search results', async () => {
      await createTestUserWithProfile({
        emailVerified: true,
        humanityVerified: true,
        humanityScore: 32,
        humanityProvider: 'gitcoin_passport',
        humanityVerifiedAt: new Date(),
      });

      const res = await request(app).get('/api/humans/search');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].humanityVerified).toBe(true);
      expect(res.body[0].humanityScore).toBe(32);
    });
  });

  describe('Search with ?verified=humanity filter', () => {
    it('should filter to only humanity-verified humans', async () => {
      await createTestUserWithProfile(
        {
          emailVerified: true,
          humanityVerified: true,
          humanityScore: 32,
          humanityProvider: 'gitcoin_passport',
          humanityVerifiedAt: new Date(),
        },
        { name: 'Verified User', email: 'verified@example.com' },
      );

      await createTestUserWithProfile(
        {
          emailVerified: true,
          humanityVerified: false,
        },
        { name: 'Unverified User', email: 'unverified@example.com' },
      );

      const res = await request(app).get('/api/humans/search?verified=humanity');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].humanityVerified).toBe(true);
    });

    it('should return all humans when verified filter is not set', async () => {
      await createTestUserWithProfile(
        {
          emailVerified: true,
          humanityVerified: true,
          humanityScore: 32,
        },
        { name: 'Verified User', email: 'verified@example.com' },
      );

      await createTestUserWithProfile(
        {
          emailVerified: true,
          humanityVerified: false,
        },
        { name: 'Unverified User', email: 'unverified@example.com' },
      );

      const res = await request(app).get('/api/humans/search');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });
  });
});
