import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

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
      expect(response.body.map((h: any) => h.name).sort()).toEqual(['Alice Smith', 'Carol Williams']);
    });

    it('should filter by skill - python', async () => {
      const response = await request(app).get('/api/humans/search?skill=python');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Bob Johnson');
    });

    it('should filter by location', async () => {
      const response = await request(app).get('/api/humans/search?location=New York');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Bob and Carol
      expect(response.body.map((h: any) => h.name).sort()).toEqual(['Bob Johnson', 'Carol Williams']);
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
      expect(response.body.map((h: any) => h.name).sort()).toEqual(['Alice Smith', 'Bob Johnson']);
    });

    it('should combine skill and location filters', async () => {
      const response = await request(app).get('/api/humans/search?skill=react&location=New York');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Carol Williams');
    });

    it('should combine skill and availability filters', async () => {
      const response = await request(app).get('/api/humans/search?skill=react&available=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Alice Smith');
    });

    it('should combine all filters', async () => {
      const response = await request(app).get(
        '/api/humans/search?skill=javascript&location=San Francisco&available=true'
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Alice Smith');
    });

    it('should return empty array when no matches', async () => {
      const response = await request(app).get('/api/humans/search?skill=rust');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should include wallets in results', async () => {
      // Add wallet to Alice
      await authRequest(alice.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xalice' });

      const response = await request(app).get('/api/humans/search?skill=react&available=true');

      expect(response.status).toBe(200);
      expect(response.body[0]).toHaveProperty('wallets');
      expect(response.body[0].wallets).toHaveLength(1);
      expect(response.body[0].wallets[0].address).toBe('0xalice');
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

    it('should expose contactEmail for public profiles', async () => {
      const response = await request(app).get('/api/humans/search?available=true');

      expect(response.status).toBe(200);
      // contactEmail should be present (it's the public contact method)
      expect(response.body[0]).toHaveProperty('contactEmail');
    });
  });
});
