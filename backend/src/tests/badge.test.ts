import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, cleanDatabase } from './helpers.js';

// Helper to get SVG text from response buffer
async function getBadge(url: string) {
  const res = await request(app)
    .get(url)
    .buffer(true)
    .parse((res, callback) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => { callback(null, data); });
    });
  return res;
}

describe('Badge API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/badge/', () => {
    it('should return SVG with generic text', async () => {
      const res = await getBadge('/api/badge/');
      expect(res.status).toBe(200);
      expect(res.body).toContain('Available on Human Pages');
    });

    it('should set Content-Type to image/svg+xml', async () => {
      const res = await getBadge('/api/badge/');
      expect(res.headers['content-type']).toContain('image/svg+xml');
    });

    it('should set Cache-Control header for 24 hours', async () => {
      const res = await getBadge('/api/badge/');
      expect(res.headers['cache-control']).toContain('max-age=86400');
    });
  });

  describe('GET /api/badge/:id', () => {
    it('should return personalized badge for existing human', async () => {
      const user = await createTestUser({ name: 'Alice' });
      const res = await getBadge(`/api/badge/${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('Hire Alice on Human Pages');
    });

    it('should fall back to generic text for long names', async () => {
      const user = await createTestUser({ name: 'A Very Long Name That Exceeds The Limit' });
      const res = await getBadge(`/api/badge/${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('Hire me on Human Pages');
    });

    it('should return generic badge for non-existent human', async () => {
      const res = await getBadge('/api/badge/non-existent-id');
      expect(res.status).toBe(200);
      expect(res.body).toContain('Hire me on Human Pages');
    });

    it('should escape XML special characters in names', async () => {
      const user = await createTestUser({ name: 'A&B' });
      const res = await getBadge(`/api/badge/${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('&amp;');
      expect(res.body).not.toContain('A&B on');
    });

    it('should set correct cache headers', async () => {
      const user = await createTestUser();
      const res = await getBadge(`/api/badge/${user.id}`);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=86400');
    });
  });
});
