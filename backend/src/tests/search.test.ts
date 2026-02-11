import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, createTestUserWithProfile, authRequest, cleanDatabase, TestUser } from './helpers.js';

describe('Search API', () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    // Create test users with different profiles
    alice = await createTestUser({ email: 'alice@example.com', name: 'Alice Smith' });
    bob = await createTestUser({ email: 'bob@example.com', name: 'Bob Johnson' });
    carol = await createTestUser({ email: 'carol@example.com', name: 'Carol Williams' });

    // Set up Alice - React developer in San Francisco
    await authRequest(alice.token)
      .patch('/api/humans/me')
      .send({
        bio: 'Full-stack developer',
        location: 'San Francisco, CA',
        skills: ['javascript', 'react', 'nodejs'],
        isAvailable: true,
      });

    // Set up Bob - Python developer in New York
    await authRequest(bob.token)
      .patch('/api/humans/me')
      .send({
        bio: 'Data scientist',
        location: 'New York, NY',
        skills: ['python', 'machine-learning', 'data-analysis'],
        isAvailable: true,
      });

    // Set up Carol - React developer in New York, not available
    await authRequest(carol.token)
      .patch('/api/humans/me')
      .send({
        bio: 'Frontend specialist',
        location: 'New York, NY',
        skills: ['javascript', 'react', 'css'],
        isAvailable: false,
      });

    // Create services for Alice
    await authRequest(alice.token)
      .post('/api/services')
      .send({
        title: 'Web Development',
        description: 'I build React apps',
        category: 'development',
        isActive: true,
      });
  });

  describe('GET /api/humans/search', () => {
    it('should return all humans when no filters', async () => {
      const response = await request(app).get('/api/humans/search');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should filter by skill', async () => {
      const response = await request(app).get('/api/humans/search?skill=react');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Alice and Carol
      expect(response.body.map((h: any) => h.id).sort()).toEqual([alice.id, carol.id].sort());
    });

    it('should filter by skill - python', async () => {
      const response = await request(app).get('/api/humans/search?skill=python');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(bob.id);
    });

    it('should filter by location', async () => {
      const response = await request(app).get('/api/humans/search?location=New York');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Bob and Carol
      expect(response.body.map((h: any) => h.id).sort()).toEqual([bob.id, carol.id].sort());
    });

    it('should filter by location - case insensitive', async () => {
      const response = await request(app).get('/api/humans/search?location=new york');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should filter by availability', async () => {
      const response = await request(app).get('/api/humans/search?available=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Alice and Bob
      expect(response.body.map((h: any) => h.id).sort()).toEqual([alice.id, bob.id].sort());
    });

    it('should combine skill and location filters', async () => {
      const response = await request(app).get('/api/humans/search?skill=react&location=New York');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(carol.id);
    });

    it('should combine skill and availability filters', async () => {
      const response = await request(app).get('/api/humans/search?skill=react&available=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });

    it('should combine all filters', async () => {
      const response = await request(app).get(
        '/api/humans/search?skill=javascript&location=San Francisco&available=true'
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });

    it('should return empty array when no matches', async () => {
      const response = await request(app).get('/api/humans/search?skill=rust');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should NOT include wallets in public search results (contact info stripped)', async () => {
      // Add wallet to Alice directly in DB
      await prisma.wallet.create({
        data: { humanId: alice.id, network: 'ethereum', address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      });

      const response = await request(app).get('/api/humans/search?skill=react&available=true');

      expect(response.status).toBe(200);
      // Wallets should be stripped from public search results
      expect(response.body[0]).not.toHaveProperty('wallets');
    });

    it('should include only active services in results', async () => {
      // Add an inactive service to Alice
      await authRequest(alice.token)
        .post('/api/services')
        .send({
          title: 'Inactive Service',
          description: 'Not available',
          category: 'test',
          isActive: false,
        });

      const response = await request(app).get('/api/humans/search?skill=react&available=true');

      expect(response.status).toBe(200);
      expect(response.body[0].services).toHaveLength(1); // Only the active service
      expect(response.body[0].services[0].title).toBe('Web Development');
    });

    it('should not expose passwordHash', async () => {
      const response = await request(app).get('/api/humans/search');

      expect(response.status).toBe(200);
      response.body.forEach((human: any) => {
        expect(human).not.toHaveProperty('passwordHash');
      });
    });

    it('should not expose name in search results', async () => {
      const response = await request(app).get('/api/humans/search');

      expect(response.status).toBe(200);
      response.body.forEach((human: any) => {
        expect(human).not.toHaveProperty('name');
      });
    });

    it('should NOT expose contactEmail in public search (contact info stripped)', async () => {
      // Explicitly unhide contact info (hideContact defaults to true)
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ hideContact: false });

      const response = await request(app).get('/api/humans/search?available=true');

      expect(response.status).toBe(200);
      // contactEmail should NOT be present — public search strips contact info
      const aliceResult = response.body.find((h: any) => h.id === alice.id);
      expect(aliceResult).not.toHaveProperty('contactEmail');
    });
  });

  describe('GET /api/humans/search - Additional Filters', () => {
    it('should filter by equipment', async () => {
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ equipment: ['camera', 'drone'] });

      const response = await request(app).get('/api/humans/search?equipment=camera');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });

    it('should filter by language', async () => {
      await authRequest(bob.token)
        .patch('/api/humans/me')
        .send({ languages: ['spanish', 'english'] });

      const response = await request(app).get('/api/humans/search?language=spanish');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(bob.id);
    });

    it('should filter by minRate', async () => {
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ minRateUsdc: 50 });
      await authRequest(bob.token)
        .patch('/api/humans/me')
        .send({ minRateUsdc: 100 });

      const response = await request(app).get('/api/humans/search?minRate=75');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(bob.id);
    });

    it('should filter by maxRate', async () => {
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ minRateUsdc: 50 });
      await authRequest(bob.token)
        .patch('/api/humans/me')
        .send({ minRateUsdc: 100 });

      const response = await request(app).get('/api/humans/search?maxRate=75');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app).get('/api/humans/search?limit=1');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('should respect offset parameter', async () => {
      const allResponse = await request(app).get('/api/humans/search');
      const offsetResponse = await request(app).get('/api/humans/search?offset=1');
      expect(offsetResponse.status).toBe(200);
      expect(offsetResponse.body).toHaveLength(allResponse.body.length - 1);
    });

    it('should filter by distance (lat/lng/radius)', async () => {
      // Set Alice in San Francisco (37.7749, -122.4194)
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ locationLat: 37.7749, locationLng: -122.4194 });
      // Set Bob in New York (40.7128, -74.0060)
      await authRequest(bob.token)
        .patch('/api/humans/me')
        .send({ locationLat: 40.7128, locationLng: -74.006 });

      // Search near San Francisco with 100km radius - should only find Alice
      const response = await request(app).get(
        '/api/humans/search?lat=37.7749&lng=-122.4194&radius=100'
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });

    it('should combine equipment + language + rate range filters', async () => {
      await authRequest(alice.token)
        .patch('/api/humans/me')
        .send({ equipment: ['camera'], languages: ['english'], minRateUsdc: 50 });
      await authRequest(bob.token)
        .patch('/api/humans/me')
        .send({ equipment: ['camera'], languages: ['spanish'], minRateUsdc: 100 });

      const response = await request(app).get(
        '/api/humans/search?equipment=camera&language=english&minRate=25&maxRate=75'
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(alice.id);
    });
  });
});
