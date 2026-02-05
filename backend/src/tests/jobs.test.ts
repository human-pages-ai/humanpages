import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

describe('Jobs API', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'jobs@example.com' });
  });

  describe('GET /api/jobs', () => {
    it('should return empty array when no jobs', async () => {
      const response = await authRequest(user.token).get('/api/jobs');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return user jobs', async () => {
      await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Web Development',
          description: 'I build websites',
          category: 'development',
        });

      const response = await authRequest(user.token).get('/api/jobs');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Web Development');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/jobs');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/jobs', () => {
    it('should create a new job listing', async () => {
      const response = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Logo Design',
          description: 'Professional logo design services',
          category: 'design',
          priceRange: '$100-500',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Logo Design');
      expect(response.body.description).toBe('Professional logo design services');
      expect(response.body.category).toBe('design');
      expect(response.body.priceRange).toBe('$100-500');
      expect(response.body.isActive).toBe(true);
    });

    it('should create job without priceRange', async () => {
      const response = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Consulting',
          description: 'Business consulting',
          category: 'consulting',
        });

      expect(response.status).toBe(201);
      expect(response.body.priceRange).toBeNull();
    });

    it('should reject empty title', async () => {
      const response = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: '',
          description: 'Some description',
          category: 'other',
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty description', async () => {
      const response = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Some Job',
          description: '',
          category: 'other',
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty category', async () => {
      const response = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Some Job',
          description: 'Description',
          category: '',
        });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Job',
          description: 'Desc',
          category: 'cat',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/jobs/:id', () => {
    let jobId: string;

    beforeEach(async () => {
      const createResponse = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'Original Title',
          description: 'Original description',
          category: 'original',
        });
      jobId = createResponse.body.id;
    });

    it('should update job title', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Original description'); // unchanged
    });

    it('should update job description', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated description');
    });

    it('should toggle job active status', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);

      // Toggle back
      const response2 = await authRequest(user.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ isActive: true });

      expect(response2.body.isActive).toBe(true);
    });

    it('should update priceRange', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ priceRange: '$50-100/hour' });

      expect(response.status).toBe(200);
      expect(response.body.priceRange).toBe('$50-100/hour');
    });

    it('should not update another user job', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await authRequest(otherUser.token)
        .patch(`/api/jobs/${jobId}`)
        .send({ title: 'Hacked' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await authRequest(user.token)
        .patch('/api/jobs/nonexistent-id')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    it('should delete own job', async () => {
      const createResponse = await authRequest(user.token)
        .post('/api/jobs')
        .send({
          title: 'To Delete',
          description: 'Will be deleted',
          category: 'test',
        });

      const jobId = createResponse.body.id;

      const response = await authRequest(user.token).delete(`/api/jobs/${jobId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Job deleted');

      // Verify deletion
      const listResponse = await authRequest(user.token).get('/api/jobs');
      expect(listResponse.body).toHaveLength(0);
    });

    it('should not delete another user job', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const createResponse = await authRequest(otherUser.token)
        .post('/api/jobs')
        .send({
          title: 'Other Job',
          description: 'Other desc',
          category: 'other',
        });

      const jobId = createResponse.body.id;

      const response = await authRequest(user.token).delete(`/api/jobs/${jobId}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await authRequest(user.token).delete('/api/jobs/nonexistent-id');

      expect(response.status).toBe(404);
    });
  });
});
