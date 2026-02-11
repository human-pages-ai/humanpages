import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createTestUser, createTestUserWithProfile, TestUser } from './helpers.js';

describe('Feedback API', () => {
  let user: TestUser;
  let adminUser: TestUser;
  const adminEmail = 'feedback-admin-test@example.com';

  beforeEach(async () => {
    await cleanDatabase();
    // Set admin email BEFORE creating the user so the middleware recognizes them
    process.env.ADMIN_EMAILS = adminEmail;
    user = await createTestUserWithProfile({ emailVerified: true });
    adminUser = await createTestUser({ email: adminEmail, name: 'Admin' });
  });

  describe('POST /api/feedback', () => {
    it('should submit general feedback with auth', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'FEEDBACK',
          description: 'Great platform, love the simplicity!',
          sentiment: 5,
          category: 'ui',
          pageUrl: 'http://localhost:3000/dashboard',
          browser: 'Chrome 120',
          os: 'macOS 14.2',
          viewport: '1920x1080',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toContain('Thank you');

      // Verify in DB
      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe('FEEDBACK');
      expect(feedback?.description).toBe('Great platform, love the simplicity!');
      expect(feedback?.sentiment).toBe(5);
      expect(feedback?.category).toBe('ui');
      expect(feedback?.humanId).toBe(user.id);
      expect(feedback?.status).toBe('NEW');
      expect(feedback?.pageUrl).toBe('http://localhost:3000/dashboard');
      expect(feedback?.browser).toBe('Chrome 120');
    });

    it('should submit bug report with all fields', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'BUG',
          title: 'Dashboard not loading',
          description: 'The dashboard shows a blank page after login',
          category: 'ui',
          severity: 'high',
          stepsToReproduce: '1. Login\n2. Go to dashboard\n3. See blank page',
          expectedBehavior: 'Dashboard should load with profile data',
          actualBehavior: 'Blank white screen',
          pageUrl: 'http://localhost:3000/dashboard',
          browser: 'Firefox 121',
          os: 'Windows 10/11',
          viewport: '1366x768',
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback?.type).toBe('BUG');
      expect(feedback?.title).toBe('Dashboard not loading');
      expect(feedback?.severity).toBe('high');
      expect(feedback?.stepsToReproduce).toContain('Login');
      expect(feedback?.expectedBehavior).toContain('Dashboard should load');
      expect(feedback?.actualBehavior).toContain('Blank white screen');
    });

    it('should submit feature request', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'FEATURE',
          title: 'Dark mode',
          description: 'Would love a dark mode option for late night work',
          category: 'ui',
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback?.type).toBe('FEATURE');
      expect(feedback?.title).toBe('Dark mode');
    });

    it('should submit feedback anonymously (no auth)', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'FEEDBACK',
          description: 'Anonymous feedback here',
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback).not.toBeNull();
      expect(feedback?.humanId).toBeNull();
      expect(feedback?.description).toBe('Anonymous feedback here');
    });

    it('should reject empty description', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'FEEDBACK',
          description: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject missing description', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'BUG',
          title: 'Something broke',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid feedback type', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'INVALID',
          description: 'This should fail',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid severity', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'BUG',
          description: 'Bug description',
          severity: 'catastrophic',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid sentiment value', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'FEEDBACK',
          description: 'Some feedback',
          sentiment: 10,
        });

      expect(res.status).toBe(400);
    });

    it('should reject description over max length', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'FEEDBACK',
          description: 'x'.repeat(5001),
        });

      expect(res.status).toBe(400);
    });

    it('should accept feedback with invalid auth token gracefully (as anonymous)', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({
          type: 'FEEDBACK',
          description: 'Submitted with bad token',
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback?.humanId).toBeNull(); // Falls back to anonymous
    });

    it('should accept screenshot data as base64', async () => {
      // Small PNG base64 (1x1 pixel)
      const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const res = await request(app)
        .post('/api/feedback')
        .send({
          type: 'BUG',
          description: 'Bug with screenshot',
          screenshotData: tinyPng,
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback?.screenshotData).toBe(tinyPng);
    });

    it('should default type to FEEDBACK when not specified', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          description: 'Just a description, no type',
        });

      expect(res.status).toBe(201);

      const feedback = await prisma.feedback.findUnique({ where: { id: res.body.id } });
      expect(feedback?.type).toBe('FEEDBACK');
    });
  });

  describe('GET /api/feedback/admin', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/feedback/admin');
      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .get('/api/feedback/admin')
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(403);
    });

    it('should list feedback for admin', async () => {
      // Submit some feedback first
      await request(app).post('/api/feedback').send({ type: 'FEEDBACK', description: 'Feedback 1' });
      await request(app).post('/api/feedback').send({ type: 'BUG', description: 'Bug report 1' });
      await request(app).post('/api/feedback').send({ type: 'FEATURE', description: 'Feature 1' });

      const res = await request(app)
        .get('/api/feedback/admin')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      await request(app).post('/api/feedback').send({ description: 'New one' });

      const created = await prisma.feedback.findFirst();
      await prisma.feedback.update({
        where: { id: created!.id },
        data: { status: 'RESOLVED' },
      });

      await request(app).post('/api/feedback').send({ description: 'Another new one' });

      const res = await request(app)
        .get('/api/feedback/admin?status=NEW')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toHaveLength(1);
      expect(res.body.feedback[0].status).toBe('NEW');
    });

    it('should filter by type', async () => {
      await request(app).post('/api/feedback').send({ type: 'BUG', description: 'Bug' });
      await request(app).post('/api/feedback').send({ type: 'FEATURE', description: 'Feature' });
      await request(app).post('/api/feedback').send({ type: 'FEEDBACK', description: 'General' });

      const res = await request(app)
        .get('/api/feedback/admin?type=BUG')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toHaveLength(1);
      expect(res.body.feedback[0].type).toBe('BUG');
    });

    it('should include user details for authenticated submissions', async () => {
      await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'From logged in user' });

      const res = await request(app)
        .get('/api/feedback/admin')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.feedback[0].human).not.toBeNull();
      expect(res.body.feedback[0].human.email).toBe(user.email);
    });

    it('should paginate results', async () => {
      // Create 5 feedbacks
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/feedback').send({ description: `Feedback ${i}` });
      }

      const res = await request(app)
        .get('/api/feedback/admin?page=1&limit=2')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toHaveLength(2);
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
    });
  });

  describe('PATCH /api/feedback/admin/:id', () => {
    it('should update feedback status', async () => {
      const createRes = await request(app).post('/api/feedback').send({ description: 'Test' });
      const feedbackId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/feedback/admin/${feedbackId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');

      const updated = await prisma.feedback.findUnique({ where: { id: feedbackId } });
      expect(updated?.status).toBe('IN_PROGRESS');
    });

    it('should update admin notes', async () => {
      const createRes = await request(app).post('/api/feedback').send({ description: 'Test' });
      const feedbackId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/feedback/admin/${feedbackId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ adminNotes: 'Looking into this issue, seems related to auth flow' });

      expect(res.status).toBe(200);

      const updated = await prisma.feedback.findUnique({ where: { id: feedbackId } });
      expect(updated?.adminNotes).toBe('Looking into this issue, seems related to auth flow');
    });

    it('should reject invalid status value', async () => {
      const createRes = await request(app).post('/api/feedback').send({ description: 'Test' });
      const feedbackId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/feedback/admin/${feedbackId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(200); // No change, invalid status ignored
      const updated = await prisma.feedback.findUnique({ where: { id: feedbackId } });
      expect(updated?.status).toBe('NEW'); // Unchanged
    });

    it('should require admin auth', async () => {
      const createRes = await request(app).post('/api/feedback').send({ description: 'Test' });

      const res = await request(app)
        .patch(`/api/feedback/admin/${createRes.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(403);
    });
  });
});
