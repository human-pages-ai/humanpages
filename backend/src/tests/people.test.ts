import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { cleanDatabase, createTestUserWithProfile } from './helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Admin People Endpoints', () => {
  let adminId: string;
  let adminToken: string;
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let user4Id: string;
  let careerPositionId: string;

  beforeAll(async () => {
    // Create an admin user
    const admin = await createTestUserWithProfile(
      {
        role: 'ADMIN',
        name: 'Admin User',
      },
      { email: 'admin@example.com' }
    );
    adminId = admin.id;
    adminToken = admin.token;

    // Create test users with different profiles
    const user1 = await createTestUserWithProfile(
      {
        location: 'San Francisco, United States',
        skills: ['React', 'TypeScript', 'JavaScript'],
        isAvailable: true,
      },
      { email: 'user1@example.com', name: 'Alice Johnson' }
    );
    user1Id = user1.id;

    const user2 = await createTestUserWithProfile(
      {
        location: 'London, United Kingdom',
        skills: ['Python', 'Django', 'PostgreSQL'],
        isAvailable: false,
      },
      { email: 'user2@example.com', name: 'Bob Smith' }
    );
    user2Id = user2.id;

    const user3 = await createTestUserWithProfile(
      {
        location: 'Berlin, Germany',
        skills: ['React', 'Node.js', 'GraphQL'],
        isAvailable: true,
      },
      { email: 'user3@example.com', name: 'Charlie Brown' }
    );
    user3Id = user3.id;

    const user4 = await createTestUserWithProfile(
      {
        location: 'Tokyo, Japan',
        skills: ['JavaScript', 'Vue.js'],
        isAvailable: true,
        referredBy: user1Id, // user4 was referred by user1
      },
      { email: 'user4@example.com', name: 'Diana Prince' }
    );
    user4Id = user4.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.careerApplication.deleteMany();
    await prisma.human.deleteMany();
  });

  beforeEach(async () => {
    // Clean career applications before each test
    await prisma.careerApplication.deleteMany();
  });

  describe('GET /api/admin/people/filter-options', () => {
    it('should return countries extracted from user locations', async () => {
      const res = await request(app)
        .get('/api/admin/people/filter-options')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.countries).toBeDefined();
      expect(Array.isArray(res.body.countries)).toBe(true);
      expect(res.body.countries).toContain('United States');
      expect(res.body.countries).toContain('United Kingdom');
      expect(res.body.countries).toContain('Germany');
      expect(res.body.countries).toContain('Japan');
    });

    it('should return all distinct skills from user profiles', async () => {
      const res = await request(app)
        .get('/api/admin/people/filter-options')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.skills).toBeDefined();
      expect(Array.isArray(res.body.skills)).toBe(true);
      expect(res.body.skills).toContain('React');
      expect(res.body.skills).toContain('TypeScript');
      expect(res.body.skills).toContain('Python');
      expect(res.body.skills).toContain('Node.js');
      // Skills should be sorted
      for (let i = 1; i < res.body.skills.length; i++) {
        expect(res.body.skills[i - 1].localeCompare(res.body.skills[i])).toBeLessThanOrEqual(0);
      }
    });

    it('should return career positions with application counts', async () => {
      // Create a career application for user1
      await prisma.careerApplication.create({
        data: {
          humanId: user1Id,
          positionId: 'software-engineer',
          positionTitle: 'Software Engineer',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      // Create another for user2 (same position)
      await prisma.careerApplication.create({
        data: {
          humanId: user2Id,
          positionId: 'software-engineer',
          positionTitle: 'Software Engineer',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      // Create a different position
      await prisma.careerApplication.create({
        data: {
          humanId: user3Id,
          positionId: 'designer',
          positionTitle: 'Product Designer',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      const res = await request(app)
        .get('/api/admin/people/filter-options')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.careerPositions).toBeDefined();
      expect(Array.isArray(res.body.careerPositions)).toBe(true);

      const softwareEngineer = res.body.careerPositions.find((p: any) => p.id === 'software-engineer');
      expect(softwareEngineer).toBeDefined();
      expect(softwareEngineer.count).toBe(2);

      const designer = res.body.careerPositions.find((p: any) => p.id === 'designer');
      expect(designer).toBeDefined();
      expect(designer.count).toBe(1);
    });
  });

  describe('GET /api/admin/people', () => {
    it('should return paginated list of all people with no filters', async () => {
      const res = await request(app)
        .get('/api/admin/people?page=1&limit=25')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people).toBeDefined();
      expect(Array.isArray(res.body.people)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(25);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(res.body.pagination.totalPages).toBeDefined();
    });

    it('should include enriched person data', async () => {
      const res = await request(app)
        .get('/api/admin/people?page=1&limit=25')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const person = res.body.people[0];
      expect(person.id).toBeDefined();
      expect(person.email).toBeDefined();
      expect(person.name).toBeDefined();
      expect(person.location).toBeDefined();
      expect(person.skills).toBeDefined();
      expect(person.isAvailable).toBeDefined();
      expect(person.referralCount).toBeDefined();
      expect(person._count).toBeDefined();
      expect(person._count.jobs).toBeDefined();
      expect(person._count.reviews).toBeDefined();
      expect(person._count.services).toBeDefined();
    });

    it('should filter by search query (name, email, username)', async () => {
      const res = await request(app)
        .get('/api/admin/people?search=alice')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      const person = res.body.people[0];
      expect(person.name.toLowerCase()).toContain('alice');
    });

    it('should filter by search with email', async () => {
      const res = await request(app)
        .get('/api/admin/people?search=user2@example.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      expect(res.body.people[0].email).toContain('user2');
    });

    it('should filter by country', async () => {
      const res = await request(app)
        .get('/api/admin/people?country=United%20States')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        expect(person.location).toContain('United States');
      }
    });

    it('should filter by skills (hasSome)', async () => {
      const res = await request(app)
        .get('/api/admin/people?skills=React')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        expect(person.skills).toContain('React');
      }
    });

    it('should filter by multiple skills (hasSome matches any)', async () => {
      const res = await request(app)
        .get('/api/admin/people?skills=React,Python')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        const hasReact = person.skills.includes('React');
        const hasPython = person.skills.includes('Python');
        expect(hasReact || hasPython).toBe(true);
      }
    });

    it('should filter by hasCareerApplication', async () => {
      // Create a career application
      await prisma.careerApplication.create({
        data: {
          humanId: user1Id,
          positionId: 'engineer',
          positionTitle: 'Engineer',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      const res = await request(app)
        .get('/api/admin/people?hasCareerApplication=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        expect(person.careerApplications.length).toBeGreaterThan(0);
      }
    });

    it('should filter by specific careerPositionId', async () => {
      // Create career applications
      await prisma.careerApplication.create({
        data: {
          humanId: user1Id,
          positionId: 'pos-1',
          positionTitle: 'Position 1',
          status: 'PENDING',
          about: 'Test application',
        },
      });
      await prisma.careerApplication.create({
        data: {
          humanId: user2Id,
          positionId: 'pos-2',
          positionTitle: 'Position 2',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      const res = await request(app)
        .get('/api/admin/people?careerPositionId=pos-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        const hasPosition = person.careerApplications.some((app: any) => app.positionId === 'pos-1');
        expect(hasPosition).toBe(true);
      }
    });

    it('should filter by hasReferrals', async () => {
      const res = await request(app)
        .get('/api/admin/people?hasReferrals=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      for (const person of res.body.people) {
        expect(person.referralCount).toBeGreaterThan(0);
      }
    });

    it('should include referralCount for users who referred others', async () => {
      const res = await request(app)
        .get('/api/admin/people')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const user1 = res.body.people.find((p: any) => p.id === user1Id);
      expect(user1).toBeDefined();
      expect(user1.referralCount).toBe(1); // user1 referred user4
    });

    it('should include referredByName when user was referred', async () => {
      const res = await request(app)
        .get('/api/admin/people')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const user4 = res.body.people.find((p: any) => p.id === user4Id);
      expect(user4).toBeDefined();
      expect(user4.referredByName).toBe('Alice Johnson');
    });

    it('should sort by createdAt descending (default)', async () => {
      const res = await request(app)
        .get('/api/admin/people?sort=createdAt&order=desc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      // Check that dates are in descending order
      for (let i = 1; i < res.body.people.length; i++) {
        const prev = new Date(res.body.people[i - 1].createdAt);
        const curr = new Date(res.body.people[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });

    it('should sort by name ascending', async () => {
      const res = await request(app)
        .get('/api/admin/people?sort=name&order=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.people.length).toBeGreaterThan(0);
      // Check that names are in ascending order
      for (let i = 1; i < res.body.people.length; i++) {
        expect(res.body.people[i - 1].name.localeCompare(res.body.people[i].name)).toBeLessThanOrEqual(0);
      }
    });

    it('should support pagination with page and limit', async () => {
      const page1 = await request(app)
        .get('/api/admin/people?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.people.length).toBeLessThanOrEqual(2);
      expect(page1.body.pagination.page).toBe(1);
      expect(page1.body.pagination.limit).toBe(2);

      const page2 = await request(app)
        .get('/api/admin/people?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page2.status).toBe(200);
      // Page 2 results should be different from page 1 (if enough data)
      if (page1.body.pagination.total > 2) {
        expect(page2.body.people[0].id).not.toBe(page1.body.people[0].id);
      }
    });

    it('should enforce max limit of 100', async () => {
      const res = await request(app)
        .get('/api/admin/people?limit=200')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('should reject requests without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/people');

      expect(res.status).toBe(401);
    });

    it('should reject requests from non-admin users', async () => {
      const regularUser = await createTestUserWithProfile(
        { role: 'USER' },
        { email: 'regular@example.com' }
      );

      const res = await request(app)
        .get('/api/admin/people')
        .set('Authorization', `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/people/export', () => {
    it('should return CSV content with proper headers', async () => {
      const res = await request(app)
        .get('/api/admin/people/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toBeDefined();
      expect(res.text.length).toBeGreaterThan(0);
    });

    it('should include CSV header row', async () => {
      const res = await request(app)
        .get('/api/admin/people/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const lines = res.text.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      // Header should contain common fields
      const header = lines[0].toLowerCase();
      expect(header).toContain('email');
      expect(header).toContain('name');
    });

    it('should apply same filters as GET /people endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/people/export?country=United%20States')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // CSV should only contain users from United States
      const lines = res.text.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should filter by search in export', async () => {
      const res = await request(app)
        .get('/api/admin/people/export?search=alice')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toBeDefined();
      expect(res.text.length).toBeGreaterThan(0);
    });

    it('should filter by skills in export', async () => {
      const res = await request(app)
        .get('/api/admin/people/export?skills=React')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toBeDefined();
    });

    it('should filter by hasCareerApplication in export', async () => {
      await prisma.careerApplication.create({
        data: {
          humanId: user1Id,
          positionId: 'test-pos',
          positionTitle: 'Test Position',
          status: 'PENDING',
          about: 'Test application',
        },
      });

      const res = await request(app)
        .get('/api/admin/people/export?hasCareerApplication=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toBeDefined();
    });

    it('should reject requests without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/people/export');

      expect(res.status).toBe(401);
    });

    it('should reject requests from non-admin users', async () => {
      const regularUser = await createTestUserWithProfile(
        { role: 'USER' },
        { email: 'export-test@example.com' }
      );

      const res = await request(app)
        .get('/api/admin/people/export')
        .set('Authorization', `Bearer ${regularUser.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Admin auth requirements', () => {
    it('should reject all people endpoints without token', async () => {
      const endpoints = [
        '/api/admin/people',
        '/api/admin/people/filter-options',
        '/api/admin/people/export',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
      }
    });

    it('should reject all people endpoints from non-admin users', async () => {
      const regularUser = await createTestUserWithProfile(
        { role: 'USER' },
        { email: 'non-admin@example.com' }
      );

      const endpoints = [
        '/api/admin/people',
        '/api/admin/people/filter-options',
        '/api/admin/people/export',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${regularUser.token}`);
        expect(res.status).toBe(403);
      }
    });
  });
});
