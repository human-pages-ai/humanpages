import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

describe('Services API', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'services@example.com' });
  });

  describe('GET /api/services', () => {
    it('should return empty array when no services', async () => {
      const response = await authRequest(user.token).get('/api/services');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return user services', async () => {
      await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Web Development',
          description: 'I build websites',
          category: 'development',
        });

      const response = await authRequest(user.token).get('/api/services');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Web Development');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/services');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/services', () => {
    it('should create a new service offering', async () => {
      const response = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Logo Design',
          description: 'Professional logo design services',
          category: 'design',
          priceMin: 100,
          priceUnit: 'FLAT_TASK',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Logo Design');
      expect(response.body.description).toBe('Professional logo design services');
      expect(response.body.category).toBe('design');
      expect(response.body.priceMin).toBe('100');
      expect(response.body.priceUnit).toBe('FLAT_TASK');
      expect(response.body.isActive).toBe(true);
    });

    it('should create service without price fields', async () => {
      const response = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Consulting',
          description: 'Business consulting',
          category: 'consulting',
        });

      expect(response.status).toBe(201);
      expect(response.body.priceMin).toBeNull();
      expect(response.body.priceUnit).toBeNull();
    });

    it('should reject empty title', async () => {
      const response = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: '',
          description: 'Some description',
          category: 'other',
        });

      expect(response.status).toBe(400);
    });

    it('should accept empty description (defaults to empty string)', async () => {
      const response = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Some Service',
          description: '',
          category: 'other',
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('');
    });

    it('should reject empty category', async () => {
      const response = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Some Service',
          description: 'Description',
          category: '',
        });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/services')
        .send({
          title: 'Service',
          description: 'Desc',
          category: 'cat',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/services/:id', () => {
    let serviceId: string;

    beforeEach(async () => {
      const createResponse = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'Original Title',
          description: 'Original description',
          category: 'original',
        });
      serviceId = createResponse.body.id;
    });

    it('should update service title', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/services/${serviceId}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Original description'); // unchanged
    });

    it('should update service description', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/services/${serviceId}`)
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated description');
    });

    it('should toggle service active status', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/services/${serviceId}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);

      // Toggle back
      const response2 = await authRequest(user.token)
        .patch(`/api/services/${serviceId}`)
        .send({ isActive: true });

      expect(response2.body.isActive).toBe(true);
    });

    it('should update price fields', async () => {
      const response = await authRequest(user.token)
        .patch(`/api/services/${serviceId}`)
        .send({ priceMin: 50, priceUnit: 'HOURLY' });

      expect(response.status).toBe(200);
      expect(response.body.priceMin).toBe('50');
      expect(response.body.priceUnit).toBe('HOURLY');
    });

    it('should not update another user service', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await authRequest(otherUser.token)
        .patch(`/api/services/${serviceId}`)
        .send({ title: 'Hacked' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found');
    });

    it('should return 404 for non-existent service', async () => {
      const response = await authRequest(user.token)
        .patch('/api/services/nonexistent-id')
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/services/:id', () => {
    it('should delete own service', async () => {
      const createResponse = await authRequest(user.token)
        .post('/api/services')
        .send({
          title: 'To Delete',
          description: 'Will be deleted',
          category: 'test',
        });

      const serviceId = createResponse.body.id;

      const response = await authRequest(user.token).delete(`/api/services/${serviceId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service deleted');

      // Verify deletion
      const listResponse = await authRequest(user.token).get('/api/services');
      expect(listResponse.body).toHaveLength(0);
    });

    it('should not delete another user service', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const createResponse = await authRequest(otherUser.token)
        .post('/api/services')
        .send({
          title: 'Other Service',
          description: 'Other desc',
          category: 'other',
        });

      const serviceId = createResponse.body.id;

      const response = await authRequest(user.token).delete(`/api/services/${serviceId}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent service', async () => {
      const response = await authRequest(user.token).delete('/api/services/nonexistent-id');

      expect(response.status).toBe(404);
    });
  });
});
