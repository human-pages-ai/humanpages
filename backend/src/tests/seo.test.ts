import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

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
    it('should return valid XML with correct Content-Type', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(res.text).toContain('</urlset>');
    });

    it('should include static pages', async () => {
      const res = await request(app).get('/sitemap.xml');

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

    it('should include profile pages for humans in database', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      expect(res.text).toContain(`<loc>${baseUrl}/humans/${user.id}</loc>`);
      expect(res.text).toContain('<changefreq>weekly</changefreq>');
      expect(res.text).toContain('<priority>0.6</priority>');
    });

    it('should return proper XML structure with url elements', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);

      // Check XML structure
      const urlCount = (res.text.match(/<url>/g) || []).length;
      const closingUrlCount = (res.text.match(/<\/url>/g) || []).length;

      // Should have at least 5 URLs (4 static + 1 profile)
      expect(urlCount).toBeGreaterThanOrEqual(5);
      expect(urlCount).toBe(closingUrlCount);

      // Each url should have loc
      const locCount = (res.text.match(/<loc>/g) || []).length;
      expect(locCount).toBe(urlCount);
    });

    it('should include lastmod for profiles with lastActiveAt', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);

      // Profile pages should have lastmod tags
      const profileUrlSection = res.text.substring(
        res.text.indexOf(`/humans/${user.id}`),
        res.text.indexOf('</url>', res.text.indexOf(`/humans/${user.id}`))
      );

      expect(profileUrlSection).toContain('<lastmod>');
      // Check date format YYYY-MM-DD
      expect(profileUrlSection).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    });

    it('should set cache headers', async () => {
      const res = await request(app).get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=3600');
    });
  });

  describe('GET /api/og/:id', () => {
    it('should return SVG image for valid human ID', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('<svg width="1200" height="630"');
      expect(svgContent).toContain('</svg>');
    });

    it('should include human name in SVG', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('SEO Test User');
    });

    it('should include human skills in SVG', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      // Check for skills (at least first few)
      expect(svgContent).toContain('photography');
      expect(svgContent).toContain('videography');
      expect(svgContent).toContain('editing');
    });

    it('should show availability status correctly', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('Available');
      expect(svgContent).toContain('#dcfce7'); // Available background color
      expect(svgContent).toContain('#15803d'); // Available text color
    });

    it('should show unavailable status when human is not available', async () => {
      // Update user to be unavailable
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({ isAvailable: false });

      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('Unavailable');
      expect(svgContent).toContain('#f1f5f9'); // Unavailable background color
      expect(svgContent).toContain('#64748b'); // Unavailable text color
    });

    it('should include bio in SVG', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('Professional photographer');
    });

    it('should include location in SVG', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('San Francisco, CA');
    });

    it('should include humanpages branding', async () => {
      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      expect(svgContent).toContain('human');
      expect(svgContent).toContain('pages');
      expect(svgContent).toContain('.ai');
      expect(svgContent).toContain('humanpages.ai');
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

    it('should escape XML special characters in user data', async () => {
      // Update current user with special characters
      await authRequest(user.token)
        .patch('/api/humans/me')
        .send({
          bio: 'Bio with "quotes" & <tags>',
          skills: ['skill&test', 'skill<test>'],
        });

      const res = await request(app).get(`/api/og/${user.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      // Check that special characters are escaped
      expect(svgContent).toContain('&amp;');
      expect(svgContent).toContain('&lt;');
      expect(svgContent).toContain('&gt;');
      expect(svgContent).toContain('&quot;');
    });
  });

  describe('GET /api/og/:id - edge cases', () => {
    it('should truncate long bios', async () => {
      const longBio = 'A'.repeat(150); // 150 characters
      await authRequest(edgeUser.token)
        .patch('/api/humans/me')
        .send({ bio: longBio });

      const res = await request(app).get(`/api/og/${edgeUser.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      // Should truncate to 117 chars + '...'
      expect(svgContent).toContain('...');
      const bioMatch = svgContent.match(new RegExp('A{117}\\.\\.\\.'));
      expect(bioMatch).toBeTruthy();
    });

    it('should limit skills to 5', async () => {
      await authRequest(edgeUser.token)
        .patch('/api/humans/me')
        .send({
          skills: ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6', 'skill7'],
        });

      const res = await request(app).get(`/api/og/${edgeUser.id}`);

      expect(res.status).toBe(200);
      const svgContent = res.text || res.body.toString();
      // Should only show first 5 skills
      expect(svgContent).toContain('skill1');
      expect(svgContent).toContain('skill5');
      expect(svgContent).not.toContain('skill6');
      expect(svgContent).not.toContain('skill7');
    });
  });
});
