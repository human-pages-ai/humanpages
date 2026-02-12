/**
 * Integration Test: Agent Onboarding Flow
 *
 * Simulates the complete journey of an AI agent:
 *   1. Register agent (get API key)
 *   2. Check activation status (PENDING)
 *   3. Request social verification code
 *   4. Activate via social verification (mocked)
 *   5. Check activation status (ACTIVE / BASIC tier)
 *   6. Update agent profile
 *   7. View agent public profile with reputation
 *   8. Test banned agent cannot activate
 *   9. Test expired activation code
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { cleanDatabase, createTestAgent, createActiveTestAgent } from '../helpers.js';

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

describe('Flow: Agent Onboarding — Registration & Activation', () => {

  it('should complete full agent lifecycle: register → activation request → check status → update profile → view public profile', async () => {
    // ─── Step 1: Register agent ────────────────────────────────────────
    const registerRes = await request(app)
      .post('/api/agents/register')
      .send({
        name: 'AutoTasker AI',
        description: 'AI agent that helps with real-world photography tasks',
        websiteUrl: 'https://autotasker.ai',
        contactEmail: 'support@autotasker.ai',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.agent).toBeDefined();
    expect(registerRes.body.apiKey).toBeDefined();
    expect(registerRes.body.apiKey).toMatch(/^hp_/);
    expect(registerRes.body.verificationToken).toBeDefined();
    expect(registerRes.body.agent.name).toBe('AutoTasker AI');
    expect(registerRes.body.agent.domainVerified).toBe(false);

    const agentId = registerRes.body.agent.id;
    const apiKey = registerRes.body.apiKey;

    // ─── Step 2: Check activation status (should be PENDING) ───────────
    const statusRes = await request(app)
      .get('/api/agents/activate/status')
      .set('X-Agent-Key', apiKey);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('PENDING');
    // activationTier defaults to 'BASIC' in the DB schema
    expect(statusRes.body.tier).toBe('BASIC');

    // ─── Step 3: Request social verification code ──────────────────────
    const socialRes = await request(app)
      .post('/api/agents/activate/social')
      .set('X-Agent-Key', apiKey);

    expect(socialRes.status).toBe(200);
    expect(socialRes.body.code).toBeDefined();
    expect(socialRes.body.code).toMatch(/^HP-/);
    expect(socialRes.body.expiresAt).toBeDefined();
    expect(socialRes.body.platforms).toBeDefined();
    expect(socialRes.body.suggestedPosts).toBeDefined();
    expect(socialRes.body.requirements).toContain('humanpages.ai');

    // ─── Step 4: Manually activate (simulate social verification) ──────
    // In real flow, social/verify calls oEmbed APIs. We simulate by directly updating DB.
    const verificationCode = socialRes.body.code;
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activationMethod: 'SOCIAL',
        activationExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        activationTier: 'BASIC',
        activationPlatform: 'twitter',
        socialPostUrl: 'https://twitter.com/test/status/123',
        socialVerificationCode: null,
        socialCodeExpiresAt: null,
      },
    });

    // ─── Step 5: Verify activation status is now ACTIVE ────────────────
    const activeStatusRes = await request(app)
      .get('/api/agents/activate/status')
      .set('X-Agent-Key', apiKey);

    expect(activeStatusRes.status).toBe(200);
    expect(activeStatusRes.body.status).toBe('ACTIVE');
    expect(activeStatusRes.body.tier).toBe('BASIC');
    expect(activeStatusRes.body.platform).toBe('twitter');
    expect(activeStatusRes.body.limits).toBeDefined();
    expect(activeStatusRes.body.limits.jobOffersPerTwoDays).toBe(1);
    expect(activeStatusRes.body.limits.profileViewsPerDay).toBe(1);

    // ─── Step 6: Update agent profile ──────────────────────────────────
    const updateRes = await request(app)
      .patch(`/api/agents/${agentId}`)
      .set('X-Agent-Key', apiKey)
      .send({
        name: 'AutoTasker AI v2',
        description: 'Updated: Now handles video and photography tasks',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('AutoTasker AI v2');
    expect(updateRes.body.description).toContain('video and photography');

    // ─── Step 7: View public agent profile ─────────────────────────────
    const publicRes = await request(app).get(`/api/agents/${agentId}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.name).toBe('AutoTasker AI v2');
    expect(publicRes.body.reputation).toBeDefined();
    expect(publicRes.body.reputation.totalJobs).toBe(0);
    expect(publicRes.body.reputation.completedJobs).toBe(0);
  });

  it('should reject registration with invalid data', async () => {
    // Empty name
    const noName = await request(app)
      .post('/api/agents/register')
      .send({ name: '', websiteUrl: 'https://example.com' });
    expect(noName.status).toBe(400);

    // Invalid URL
    const badUrl = await request(app)
      .post('/api/agents/register')
      .send({ name: 'Test', websiteUrl: 'not-a-url' });
    expect(badUrl.status).toBe(400);

    // Invalid email
    const badEmail = await request(app)
      .post('/api/agents/register')
      .send({ name: 'Test', contactEmail: 'not-email' });
    expect(badEmail.status).toBe(400);
  });

  it('should prevent banned agent from requesting activation', async () => {
    const agent = await createTestAgent({ name: 'Banned Agent' });

    // Ban the agent
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: 'BANNED' },
    });

    const socialRes = await request(app)
      .post('/api/agents/activate/social')
      .set('X-Agent-Key', agent.apiKey);

    expect(socialRes.status).toBe(403);
    expect(socialRes.body.error).toContain('banned');
  });

  it('should prevent different agent from updating another agent profile', async () => {
    const agent1 = await createTestAgent({ name: 'Agent 1' });
    const agent2 = await createTestAgent({ name: 'Agent 2' });

    const updateRes = await request(app)
      .patch(`/api/agents/${agent1.id}`)
      .set('X-Agent-Key', agent2.apiKey)
      .send({ name: 'Hijack!' });

    expect(updateRes.status).toBe(403);
  });

  it('should handle expired social verification code', async () => {
    const agent = await createTestAgent({ name: 'Expired Code Agent' });

    // Set an expired code
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        socialVerificationCode: 'HP-EXPIRED123',
        socialCodeExpiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    });

    const verifyRes = await request(app)
      .post('/api/agents/activate/social/verify')
      .set('X-Agent-Key', agent.apiKey)
      .send({ postUrl: 'https://twitter.com/test/status/456' });

    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body.error).toContain('expired');
  });

  it('should return 404 for non-existent agent public profile', async () => {
    const res = await request(app).get('/api/agents/non-existent-id');
    expect(res.status).toBe(404);
  });

  it('should require API key for activation status check', async () => {
    const res = await request(app).get('/api/agents/activate/status');
    expect(res.status).toBe(401);
  });
});
