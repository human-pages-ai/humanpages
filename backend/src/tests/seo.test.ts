import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';
import { generateProfileSvg, generateBlogSvg, generateDefaultSvg } from '../routes/og.js';

describe('SEO Endpoints', () => {
  let user: TestUser;
  let edgeUser: TestUser;

  beforeAll(async () => {
    await cleanDatabase();

    // Create main test user
    user = await createTestUser({ email: 'seo@example.com', name: 'SEO Test User' });

    // Set up profile with skills, location, bio
    await authRequest(user.token)
      .patch('/api/humans/me')
      .send({
        bio: 'Professional photographer and videographer with 10 years experience',
        location: 'San Francisco, CA',
        skills: ['photography', 'videography', 'editing', 'lighting', 'post-production'],
        isAvailable: true,
      });

    // Create edge case user
    edgeUser = await createTestUser({
      email: 'edge@example.com',
      name: 'Edge Case User'
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('GET /sitemap.xml', () => {
    it('should return sitemapindex with correct Content-Type', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(res.text).toContain('sitemap-static.xml');
      expect(res.text).toContain('</sitemapindex>');
    });

    it('should include static pages in sitemap-static.xml', async () => {
      const res = await request(app).get('/api/sitemap-static.xml');

      expect(res.status).toBe(200);

      // Check for all static pages (use localhost in test environment)
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      expect(res.text).toContain(`<loc>${baseUrl}/</loc>`);
      expect(res.text).toContain(`<loc>${baseUrl}/dev</loc>`);
      expect(res.text).toContain(`<loc>${baseUrl}/signup</loc>`);
      expect(res.text).toContain(`<loc>${baseUrl}/login</loc>`);

      // Check for priorities and changefreq
      expect(res.text).toContain('<priority>1.0</priority>');
      expect(res.text).toContain('<changefreq>daily</changefreq>');
      expect(res.text).toContain('<changefreq>weekly</changefreq>');
      expect(res.text).toContain('<changefreq>monthly</changefreq>');
    });

    it('should not include profile pages in sitemap-static.xml', async () => {
      const res = await request(app).get('/api/sitemap-static.xml');

      expect(res.status).toBe(200);
      expect(res.text).not.toContain('/humans/');
    });

    it('should return proper XML structure in sitemap-static.xml', async () => {
      const res = await request(app).get('/api/sitemap-static.xml');

      expect(res.status).toBe(200);

      // Check XML structure
      const urlCount = (res.text.match(/<url>/g) || []).length;
      const closingUrlCount = (res.text.match(/<\/url>/g) || []).length;

      // Should have static pages only
      expect(urlCount).toBeGreaterThanOrEqual(10);
      expect(urlCount).toBe(closingUrlCount);

      // Each url should have loc
      const locCount = (res.text.match(/<loc>/g) || []).length;
      expect(locCount).toBe(urlCount);
    });

    it('should set cache headers', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=3600');
    });
  });

  describe('GET /api/og/:id', () => {
    it('should return PNG image for valid human ID', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      // PNG magic bytes: 0x89 0x50 0x4E 0x47
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50); // P
      expect(res.body[2]).toBe(0x4e); // N
      expect(res.body[3]).toBe(0x47); // G
    });

    it('should return 404 for non-existent human ID', async () => {
      const res = await request(app).get('/api/og/nonexistent-id-12345');

      expect(res.status).toBe(404);
      expect(res.text).toContain('Not found');
    });

    it('should set cache headers', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=86400'); // 24 hours
    });
  });

  describe('GET /api/og/default', () => {
    it('should return PNG image', async () => {
      const res = await request(app).get('/api/og/default');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
    });

    it('should set long cache headers', async () => {
      const res = await request(app).get('/api/og/default');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=604800'); // 7 days
    });
  });

  describe('GET /api/og/blog/:slug', () => {
    it('should return PNG image for valid slug', async () => {
      const res = await request(app).get('/api/og/blog/ai-agents-hiring-humans');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
    });

    it('should return 404 for invalid slug', async () => {
      const res = await request(app).get('/api/og/blog/nonexistent-post');

      expect(res.status).toBe(404);
    });
  });

  describe('SVG generation functions', () => {
    it('should include human name in profile SVG', () => {
      const svg = generateProfileSvg('SEO Test User', 'Bio text', 'San Francisco, CA', ['photography'], true);
      expect(svg).toContain('SEO Test User');
    });

    it('should include skills in profile SVG', () => {
      const svg = generateProfileSvg('Test', '', '', ['photography', 'videography', 'editing'], true);
      expect(svg).toContain('photography');
      expect(svg).toContain('videography');
      expect(svg).toContain('editing');
    });

    it('should show availability status correctly', () => {
      const available = generateProfileSvg('Test', '', '', [], true);
      expect(available).toContain('Available');
      expect(available).toContain('#dcfce7');
      expect(available).toContain('#15803d');

      const unavailable = generateProfileSvg('Test', '', '', [], false);
      expect(unavailable).toContain('Unavailable');
      expect(unavailable).toContain('#f1f5f9');
      expect(unavailable).toContain('#64748b');
    });

    it('should include bio in profile SVG', () => {
      const svg = generateProfileSvg('Test', 'Professional photographer', '', [], true);
      expect(svg).toContain('Professional photographer');
    });

    it('should include location in profile SVG', () => {
      const svg = generateProfileSvg('Test', '', 'San Francisco, CA', [], true);
      expect(svg).toContain('San Francisco, CA');
    });

    it('should include humanpages branding', () => {
      const svg = generateProfileSvg('Test', '', '', [], true);
      expect(svg).toContain('human');
      expect(svg).toContain('pages');
      expect(svg).toContain('.ai');
      expect(svg).toContain('humanpages.ai');
    });

    it('should escape XML special characters', () => {
      const svg = generateProfileSvg('Test', 'Bio with "quotes" & <tags>', '', ['skill&test', 'skill<test>'], true);
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&lt;');
      expect(svg).toContain('&gt;');
      expect(svg).toContain('&quot;');
    });

    it('should truncate long bios', () => {
      const longBio = 'A'.repeat(150);
      const svg = generateProfileSvg('Test', longBio, '', [], true);
      expect(svg).toContain('...');
      const bioMatch = svg.match(new RegExp('A{117}\\.\\.\\.'));
      expect(bioMatch).toBeTruthy();
    });

    it('should limit skills to 5', () => {
      const svg = generateProfileSvg('Test', '', '', ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6', 'skill7'], true);
      expect(svg).toContain('skill1');
      expect(svg).toContain('skill5');
      expect(svg).not.toContain('skill6');
      expect(svg).not.toContain('skill7');
    });

    it('should generate valid default SVG', () => {
      const svg = generateDefaultSvg();
      expect(svg).toContain('<svg width="1200" height="630"');
      expect(svg).toContain('humanpages.ai');
      expect(svg).toContain('Get Hired by AI Agents');
    });

    it('should generate blog SVG with title', () => {
      const svg = generateBlogSvg('How AI Agents Are Hiring Humans');
      expect(svg).toContain('<svg width="1200" height="630"');
      expect(svg).toContain('humanpages.ai/blog');
      expect(svg).toContain('Blog');
    });
  });
});
