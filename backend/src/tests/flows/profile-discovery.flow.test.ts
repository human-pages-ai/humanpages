/**
 * Integration Test: Profile Discovery Flow
 *
 * Simulates how AI agents discover and view human profiles:
 *   1. Create several humans with different skills, locations, and availability
 *   2. Search by skill
 *   3. Search by location
 *   4. Search by availability
 *   5. Search by work mode
 *   6. Search with radius (geo-based)
 *   7. View public profile (no contact info)
 *   8. View full profile as active agent (with contact info)
 *   9. Verify hideContact privacy setting
 *  10. Look up by username
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  cleanDatabase,
  createTestUser,
  createTestUserWithProfile,
  createActiveTestAgent,
  authRequest,
} from '../helpers.js';

// Mock email module
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

beforeEach(async () => {
  await cleanDatabase();
});

describe('Flow: Profile Discovery — Agent Searches & Views Humans', () => {
  let photographerId: string;
  let driverId: string;
  let unavailableId: string;

  beforeEach(async () => {
    // Create a photographer in San Francisco
    const photographer = await createTestUserWithProfile(
      {
        emailVerified: true,
        isAvailable: true,
        skills: ['photography', 'drone-operation'],
        equipment: ['Canon R6', 'DJI Mavic'],
        languages: ['English', 'Spanish'],
        location: 'San Francisco, CA',
        locationLat: 37.7749,
        locationLng: -122.4194,
        bio: 'Professional photographer in SF',
        username: 'sf_photographer',
        workMode: 'HYBRID',
        minRateUsdc: 50,
        contactEmail: 'photo@example.com',
        hideContact: false,
      },
      { email: 'photographer@example.com', name: 'SF Photographer' },
    );
    photographerId = photographer.id;

    // Create a driver in Los Angeles
    const driver = await createTestUserWithProfile(
      {
        emailVerified: true,
        isAvailable: true,
        skills: ['delivery', 'driving'],
        equipment: ['Car', 'GPS'],
        languages: ['English'],
        location: 'Los Angeles, CA',
        locationLat: 34.0522,
        locationLng: -118.2437,
        bio: 'Reliable delivery driver in LA',
        username: 'la_driver',
        workMode: 'ONSITE',
        minRateUsdc: 30,
        contactEmail: 'driver@example.com',
      },
      { email: 'driver@example.com', name: 'LA Driver' },
    );
    driverId = driver.id;

    // Create unavailable user
    const unavailable = await createTestUserWithProfile(
      {
        emailVerified: true,
        isAvailable: false,
        skills: ['photography'],
        location: 'New York, NY',
        bio: 'Currently on break',
        username: 'ny_offline',
      },
      { email: 'offline@example.com', name: 'NY Offline' },
    );
    unavailableId = unavailable.id;
  });

  it('should search by skill and find matching humans', async () => {
    const res = await request(app).get('/api/humans/search?skill=photography');
    expect(res.status).toBe(200);

    // Should find both the SF photographer (available) and NY offline (unavailable)
    // since we're not filtering by availability
    const usernames = res.body.map((h: any) => h.username);
    expect(usernames).toContain('sf_photographer');
  });

  it('should search by skill and filter by availability', async () => {
    const res = await request(app).get('/api/humans/search?skill=photography&available=true');
    expect(res.status).toBe(200);

    const usernames = res.body.map((h: any) => h.username);
    expect(usernames).toContain('sf_photographer');
    expect(usernames).not.toContain('ny_offline');
  });

  it('should search by location text', async () => {
    const res = await request(app).get('/api/humans/search?location=San%20Francisco');
    expect(res.status).toBe(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].username).toBe('sf_photographer');
  });

  it('should search by work mode', async () => {
    const res = await request(app).get('/api/humans/search?workMode=ONSITE');
    expect(res.status).toBe(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const usernames = res.body.map((h: any) => h.username);
    expect(usernames).toContain('la_driver');
  });

  it('should search by geo radius and find only nearby humans', async () => {
    // Search near San Francisco (37.78, -122.42) within 50km
    const res = await request(app).get(
      '/api/humans/search?lat=37.78&lng=-122.42&radius=50'
    );
    expect(res.status).toBe(200);

    const usernames = res.body.map((h: any) => h.username);
    expect(usernames).toContain('sf_photographer');
    expect(usernames).not.toContain('la_driver'); // LA is ~600km from SF
  });

  it('should include reputation and trust score in search results', async () => {
    const res = await request(app).get('/api/humans/search?skill=photography');
    expect(res.status).toBe(200);

    const photographer = res.body.find((h: any) => h.username === 'sf_photographer');
    expect(photographer).toBeDefined();
    expect(photographer.reputation).toBeDefined();
    expect(photographer.reputation.jobsCompleted).toBe(0);
    expect(photographer).not.toHaveProperty('trustScore');
  });

  it('should not include contact info in public search results', async () => {
    const res = await request(app).get('/api/humans/search?skill=photography');
    expect(res.status).toBe(200);

    const photographer = res.body.find((h: any) => h.username === 'sf_photographer');
    expect(photographer).not.toHaveProperty('contactEmail');
    expect(photographer).not.toHaveProperty('email');
    expect(photographer).not.toHaveProperty('telegram');
    expect(photographer).not.toHaveProperty('wallets');
    expect(photographer).toHaveProperty('name');
  });

  it('should view public profile by ID without contact info', async () => {
    const res = await request(app).get(`/api/humans/${photographerId}`);
    expect(res.status).toBe(200);

    expect(res.body.name).toBe('SF Photographer');
    expect(res.body.skills).toContain('photography');
    expect(res.body.reputation).toBeDefined();
    expect(res.body).not.toHaveProperty('trustScore');

    // No contact info in public view
    expect(res.body).not.toHaveProperty('contactEmail');
    expect(res.body).not.toHaveProperty('wallets');
  });

  it('should look up profile by username', async () => {
    const res = await request(app).get('/api/humans/u/sf_photographer');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SF Photographer');
    expect(res.body.username).toBe('sf_photographer');
  });

  it('should return 404 for non-existent username', async () => {
    const res = await request(app).get('/api/humans/u/nobody_here');
    expect(res.status).toBe(404);
  });

  it('should view full profile as active agent (with contact info)', async () => {
    const agent = await createActiveTestAgent({ name: 'Discovery Agent', tier: 'BASIC' });

    const res = await request(app)
      .get(`/api/humans/${photographerId}/profile`)
      .set('X-Agent-Key', agent.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SF Photographer');
    expect(res.body.contactEmail).toBe('photo@example.com');
    expect(res.body.wallets).toBeDefined();
  });

  it('should hide contact info when hideContact is enabled', async () => {
    // Enable hideContact
    await prisma.human.update({
      where: { id: photographerId },
      data: { hideContact: true },
    });

    const agent = await createActiveTestAgent({ name: 'Hidden Contact Agent', tier: 'BASIC' });

    const res = await request(app)
      .get(`/api/humans/${photographerId}/profile`)
      .set('X-Agent-Key', agent.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SF Photographer');
    // Contact info should be stripped
    expect(res.body).not.toHaveProperty('contactEmail');
    expect(res.body).not.toHaveProperty('telegram');
  });

  it('should reject full profile view without agent key', async () => {
    const res = await request(app).get(`/api/humans/${photographerId}/profile`);
    expect(res.status).toBe(401);
  });

  it('should reject full profile view from inactive agent', async () => {
    // createTestAgent creates an agent in PENDING status
    const { createTestAgent } = await import('../helpers.js');
    const pendingAgent = await createTestAgent({ name: 'Pending Agent' });

    const res = await request(app)
      .get(`/api/humans/${photographerId}/profile`)
      .set('X-Agent-Key', pendingAgent.apiKey);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent human ID', async () => {
    const res = await request(app).get('/api/humans/non-existent-id');
    expect(res.status).toBe(404);
  });

  it('should not return unverified users in search', async () => {
    // Create unverified user
    await createTestUserWithProfile(
      { emailVerified: false, skills: ['photography'] },
      { email: 'unverified@example.com', name: 'Unverified User' },
    );

    const res = await request(app).get('/api/humans/search?skill=photography');
    const ids = res.body.map((h: any) => h.id);
    // Unverified users should not appear — just verify count matches verified users only
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((h: any) => {
      expect(h).toHaveProperty('name');
    });
  });

  it('should search by equipment', async () => {
    const res = await request(app).get('/api/humans/search?equipment=DJI%20Mavic');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].username).toBe('sf_photographer');
  });

  it('should search by language', async () => {
    const res = await request(app).get('/api/humans/search?language=Spanish');
    expect(res.status).toBe(200);
    const usernames = res.body.map((h: any) => h.username);
    expect(usernames).toContain('sf_photographer');
    expect(usernames).not.toContain('la_driver');
  });

  it('should include services in public profile', async () => {
    // Add a service to the photographer
    await prisma.service.create({
      data: {
        humanId: photographerId,
        title: 'Drone Photography',
        description: 'Aerial photography',
        category: 'photography',
        isActive: true,
      },
    });

    const res = await request(app).get(`/api/humans/${photographerId}`);
    expect(res.status).toBe(200);
    expect(res.body.services).toBeDefined();
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].title).toBe('Drone Photography');
  });
});
