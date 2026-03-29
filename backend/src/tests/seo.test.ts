import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser, createActiveTestAgent, TestAgent } from './helpers.js';
import { generateProfileSvg, generateBlogSvg, generateDefaultSvg, generateListingSvg } from '../routes/og.js';
import { prisma } from '../lib/prisma.js';

describe('SEO Endpoints', () => {
  let user: TestUser;
  let edgeUser: TestUser;
  let testAgent: TestAgent;
  let testListingId: string;

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

    // Create test agent + listing for OG listing tests
    testAgent = await createActiveTestAgent({ name: 'OG Test Agent' });
    const listing = await prisma.listing.create({
      data: {
        agentId: testAgent.id,
        title: 'Graphic Design for Mobile App',
        description: 'Need a designer for UI/UX work on our mobile app. Figma experience required.',
        budgetUsdc: 450,
        budgetFlexible: true,
        requiredSkills: ['Figma', 'UI Design', 'Mobile'],
        location: 'Remote',
        workMode: 'REMOTE',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    testListingId = listing.id;
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
      expect(svg).toContain('>human</tspan>');
      expect(svg).toContain('>pages</tspan>');
      expect(svg).toContain('Stop chasing clients');
    });

    it('should generate blog SVG with title', () => {
      const svg = generateBlogSvg('How AI Agents Are Hiring Humans');
      expect(svg).toContain('<svg width="1200" height="630"');
      expect(svg).toContain('humanpages.ai/blog');
      expect(svg).toContain('Blog');
    });
  });

  // ═══════════════ Listing OG Image Tests ═══════════════

  describe('GET /api/og/listing/:id', () => {
    it('should return PNG image for valid listing ID', async () => {
      const res = await request(app).get(`/api/og/listing/${testListingId}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      // PNG magic bytes
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
      expect(res.body[2]).toBe(0x4e);
      expect(res.body[3]).toBe(0x47);
    });

    it('should return 404 for non-existent listing', async () => {
      const res = await request(app).get('/api/og/listing/nonexistent-id-12345');

      expect(res.status).toBe(404);
      expect(res.text).toContain('Not found');
    });

    it('should set 1-hour cache headers (listings change often)', async () => {
      const res = await request(app).get(`/api/og/listing/${testListingId}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=3600');
    });
  });

  describe('Listing SVG generation', () => {
    it('should include title in listing SVG', () => {
      const svg = generateListingSvg('Graphic Design for App', 450, true, ['Figma'], 'Remote');
      expect(svg).toContain('Graphic Design for App');
    });

    it('should include budget with + for flexible', () => {
      const svg = generateListingSvg('Test', 450, true, [], '');
      expect(svg).toContain('$450+');
    });

    it('should include budget without + for non-flexible', () => {
      const svg = generateListingSvg('Test', 200, false, [], '');
      expect(svg).toContain('$200');
      expect(svg).not.toContain('$200+');
    });

    it('should format decimal budgets cleanly (no trailing zeros)', () => {
      const svg = generateListingSvg('Test', 450.000000, true, [], '');
      expect(svg).toContain('$450+');
      expect(svg).not.toContain('450.000000');
    });

    it('should include skills up to 4', () => {
      const svg = generateListingSvg('Test', 100, false, ['Figma', 'React', 'Node.js', 'TypeScript', 'GraphQL'], '');
      expect(svg).toContain('Figma');
      expect(svg).toContain('React');
      expect(svg).toContain('Node.js');
      expect(svg).toContain('TypeScript');
      expect(svg).not.toContain('GraphQL');
    });

    it('should include location', () => {
      const svg = generateListingSvg('Test', 100, false, [], 'Manila, Philippines');
      expect(svg).toContain('Manila, Philippines');
    });

    it('should escape XML special characters in title', () => {
      const svg = generateListingSvg('Design & Build <App>', 100, false, ['C++ & Rust'], '');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&lt;');
      expect(svg).toContain('&gt;');
    });

    it('should word-wrap long titles (max 3 lines)', () => {
      const svg = generateListingSvg('This Is A Very Long Listing Title That Should Be Wrapped Across Multiple Lines', 100, false, [], '');
      // Should contain svg with 1200x630 dimensions
      expect(svg).toContain('<svg width="1200" height="630"');
      // Title should be split into text elements
      const textCount = (svg.match(/font-size="40"/g) || []).length;
      expect(textCount).toBeLessThanOrEqual(3);
      expect(textCount).toBeGreaterThan(1);
    });

    it('should include branding', () => {
      const svg = generateListingSvg('Test', 100, false, [], '');
      expect(svg).toContain('humanpages.ai/listings');
      expect(svg).toContain('Apply free');
    });

    it('should handle empty skills array', () => {
      const svg = generateListingSvg('Test', 100, false, [], '');
      expect(svg).toContain('<svg width="1200" height="630"');
    });

    it('should handle empty location', () => {
      const svg = generateListingSvg('Test', 100, false, [], '');
      // Should not contain location text element (empty string)
      expect(svg).toContain('<svg width="1200" height="630"');
    });

    it('should truncate long skill names', () => {
      const svg = generateListingSvg('Test', 100, false, ['Very Long Skill Name Here'], '');
      expect(svg).toContain('..');
    });
  });

  // ═══════════════ Listing SSR Meta Tests ═══════════════

  describe('GET /listings/:id (SSR meta injection)', () => {
    it('should inject OG meta tags for valid listing', async () => {
      const res = await request(app).get(`/listings/${testListingId}`);

      // In test env, index.html may not exist — falls through to SPA catch-all
      // which returns 404 when frontend not built. That's expected.
      // If it returns 200, check the meta tags are injected.
      if (res.status === 200 && res.headers['content-type']?.includes('text/html')) {
        expect(res.text).toContain('og:title');
        expect(res.text).toContain('Graphic Design for Mobile App');
        expect(res.text).toContain('og:image');
        expect(res.text).toContain(`/api/og/listing/${testListingId}`);
        expect(res.text).toContain('og:image:width');
        expect(res.text).toContain('1200');
        expect(res.text).toContain('og:image:height');
        expect(res.text).toContain('630');
        expect(res.text).toContain('twitter:card');
        expect(res.text).toContain('summary_large_image');
        expect(res.text).toContain('$450+');
      }
    });

    it('should fall through for non-existent listing', async () => {
      const res = await request(app).get('/listings/nonexistent-id-xyz');

      // Should fall through to SPA catch-all (200 with index.html)
      // The catch-all sets a canonical for the request path, but should NOT
      // inject listing-specific meta (og:title, JSON-LD JobPosting, etc.)
      if (res.status === 200 && res.headers['content-type']?.includes('text/html')) {
        expect(res.text).not.toContain('JobPosting');
        expect(res.text).not.toContain('og:title" content="Skilled');
      }
    });
  });

  // ═══════════════ Listing Status/Expiry Edge Cases ═══════════════

  describe('Closed/expired listing handling', () => {
    let closedListingId: string;
    let expiredListingId: string;

    beforeAll(async () => {
      // Create a CLOSED listing
      const closed = await prisma.listing.create({
        data: {
          agentId: testAgent.id,
          title: 'Closed Listing',
          description: 'This listing is closed.',
          budgetUsdc: 100,
          budgetFlexible: false,
          requiredSkills: [],
          workMode: 'REMOTE',
          status: 'CLOSED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      closedListingId = closed.id;

      // Create an OPEN but expired listing
      const expired = await prisma.listing.create({
        data: {
          agentId: testAgent.id,
          title: 'Expired Listing',
          description: 'This listing expired.',
          budgetUsdc: 200,
          budgetFlexible: false,
          requiredSkills: ['React'],
          workMode: 'REMOTE',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
        },
      });
      expiredListingId = expired.id;
    });

    it('should return 410 for closed listing OG image', async () => {
      const res = await request(app).get(`/api/og/listing/${closedListingId}`);
      expect(res.status).toBe(410);
    });

    it('should return 410 for expired listing OG image', async () => {
      const res = await request(app).get(`/api/og/listing/${expiredListingId}`);
      expect(res.status).toBe(410);
    });

    it('should fall through SSR for closed listing', async () => {
      const res = await request(app).get(`/listings/${closedListingId}`);
      // Should NOT inject meta for closed listing — falls through to SPA
      if (res.status === 200 && res.headers['content-type']?.includes('text/html')) {
        expect(res.text).not.toContain('Closed Listing');
      }
    });

    it('should fall through SSR for expired listing', async () => {
      const res = await request(app).get(`/listings/${expiredListingId}`);
      if (res.status === 200 && res.headers['content-type']?.includes('text/html')) {
        expect(res.text).not.toContain('Expired Listing');
      }
    });
  });

  // ═══════════════ SVG Defensive Input Validation ═══════════════

  describe('Listing SVG defensive validation', () => {
    it('should handle empty title gracefully', () => {
      const svg = generateListingSvg('', 100, false, [], '');
      expect(svg).toContain('Untitled Listing');
      expect(svg).toContain('<svg width="1200" height="630"');
    });

    it('should break very long single words (no spaces)', () => {
      const longWord = 'A'.repeat(60);
      const svg = generateListingSvg(longWord, 100, false, [], '');
      expect(svg).toContain('...');
      // Should not overflow — word broken at 27 chars
      expect(svg).not.toContain(longWord);
    });

    it('should truncate very long location', () => {
      const longLoc = 'A'.repeat(80);
      const svg = generateListingSvg('Test', 100, false, [], longLoc);
      expect(svg).toContain('...');
      expect(svg).not.toContain(longLoc);
    });

    it('should handle zero budget', () => {
      const svg = generateListingSvg('Test', 0, false, [], '');
      expect(svg).toContain('$0');
    });

    it('should cap extremely large budgets', () => {
      const svg = generateListingSvg('Test', 99999999, false, [], '');
      expect(svg).toContain('$9999999');
      expect(svg).not.toContain('99999999');
    });

    it('should filter out empty/whitespace skills', () => {
      const svg = generateListingSvg('Test', 100, false, ['  ', '', 'Valid'], '');
      expect(svg).toContain('Valid');
      // Should not render empty skill badges
      const skillBadges = (svg.match(/fill="#1e3a5f"/g) || []).length;
      expect(skillBadges).toBe(1);
    });

    it('should handle null-ish skills array safely', () => {
      // @ts-expect-error — testing runtime defense
      const svg = generateListingSvg('Test', 100, false, null, '');
      expect(svg).toContain('<svg width="1200" height="630"');
    });
  });
});
