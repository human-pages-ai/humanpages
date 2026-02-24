import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import fs from 'fs/promises';
import path from 'path';

// Mock email module (imported by other routes that app loads)
vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
}));

const API_KEY = 'test-admin-api-key-12345';

// PHOTO_PIPELINE_DIR is resolved as a top-level const in photoConcepts.ts
// at module import time. We can't change it per-test — we must use the
// directory that vitest.config.ts already set before the module loaded.
const tempDir = process.env.PHOTO_PIPELINE_DIR!;

function apiKeyHeader() {
  return { 'X-Admin-API-Key': API_KEY };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Reset the directory contents between tests (dir was created by vitest.config.ts)
  await fs.mkdir(path.join(tempDir, 'data', 'queue'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'output'), { recursive: true });

  // Write a valid empty batch
  await fs.writeFile(
    path.join(tempDir, 'suggested_batch.json'),
    JSON.stringify([])
  );

  // Write empty status
  await fs.writeFile(
    path.join(tempDir, 'data', 'photo_status.json'),
    JSON.stringify({})
  );

  // Clean up any queue files from previous tests
  const queueDir = path.join(tempDir, 'data', 'queue');
  const queueFiles = await fs.readdir(queueDir).catch(() => []);
  for (const f of queueFiles) {
    await fs.unlink(path.join(queueDir, f)).catch(() => {});
  }

  // Clean up any output directories from previous tests
  const outputDir = path.join(tempDir, 'output');
  const outputEntries = await fs.readdir(outputDir).catch(() => []);
  for (const entry of outputEntries) {
    await fs.rm(path.join(outputDir, entry), { recursive: true, force: true }).catch(() => {});
  }
});

// ─── Auth Tests ─────────────────────────────────────────────────────────────

describe('Photo Concepts API — Auth', () => {
  it('should return 401 without any auth', async () => {
    const res = await request(app).get('/api/admin/photo-concepts');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  it('should return 401 with wrong API key', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set('X-Admin-API-Key', 'wrong-key-definitely');
    expect(res.status).toBe(401);
  });

  it('should accept valid API key', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('concepts');
  });
});

// ─── GET / — List Concepts ──────────────────────────────────────────────────

describe('GET /api/admin/photo-concepts', () => {
  it('should return empty concepts array when batch is empty', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.concepts).toEqual([]);
  });

  it('should return concepts from batch file', async () => {
    const batch = [
      {
        title: 'Test Meme One',
        concept: 'A funny meme about AI',
        post_type: 'meme_classic',
        target_platforms: ['twitter', 'instagram'],
        tone: 'deadpan',
      },
      {
        title: 'Second Concept',
        concept: 'Another concept',
        post_type: 'quote_card',
        target_platforms: ['linkedin'],
        tone: 'inspirational',
      },
    ];
    await fs.writeFile(
      path.join(tempDir, 'suggested_batch.json'),
      JSON.stringify(batch)
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.concepts).toHaveLength(2);
    expect(res.body.concepts[0]).toHaveProperty('slug');
    expect(res.body.concepts[0]).toHaveProperty('title');
    expect(res.body.concepts[0]).toHaveProperty('status');
    expect(res.body.concepts[0]).toHaveProperty('postType');
  });

  it('should handle missing batch file gracefully', async () => {
    await fs.unlink(path.join(tempDir, 'suggested_batch.json'));

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.concepts).toEqual([]);
  });

  it('should handle malformed JSON in batch file', async () => {
    await fs.writeFile(
      path.join(tempDir, 'suggested_batch.json'),
      '{"broken json \x00 with control chars'
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    // Should fail gracefully — either 200 with empty or 500
    expect([200, 500]).toContain(res.status);
  });

  it('should handle malformed status file gracefully', async () => {
    await fs.writeFile(
      path.join(tempDir, 'data', 'photo_status.json'),
      'not valid json'
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
  });
});

// ─── POST / — Create Concept ────────────────────────────────────────────────

describe('POST /api/admin/photo-concepts', () => {
  it('should create a new concept', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({
        title: 'My New Meme',
        concept: 'A hilarious meme about working from home',
        post_type: 'meme_caption',
        target_platforms: ['twitter', 'instagram'],
        tone: 'deadpan',
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('my-new-meme');
    expect(res.body.title).toBe('My New Meme');
    expect(res.body.postType).toBe('meme_caption');
  });

  it('should reject missing title', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ concept: 'No title provided' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
  });

  it('should reject duplicate slug', async () => {
    // Create first
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Unique Meme' });

    // Try duplicate
    const res = await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Unique Meme' });

    expect(res.status).toBe(409);
  });

  it('should default to meme_caption if invalid post_type', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Default Type Test', post_type: 'nonexistent_type' });

    expect(res.status).toBe(201);
    expect(res.body.postType).toBe('meme_caption');
  });

  it('should accept all 14 valid post types', async () => {
    const types = [
      'meme_classic', 'meme_caption', 'meme_multi_panel', 'meme_reaction', 'meme_labeled',
      'job_screenshot', 'chat_screenshot', 'quote_card', 'stat_card', 'comparison',
      'testimonial', 'listicle', 'announcement', 'infographic',
    ];

    for (const type of types) {
      const res = await request(app)
        .post('/api/admin/photo-concepts')
        .set(apiKeyHeader())
        .send({ title: `Test ${type}`, post_type: type });

      expect(res.status).toBe(201);
      expect(res.body.postType).toBe(type);
    }
  });

  it('should persist to batch file on disk', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Disk Persist Test' });

    const batchContent = await fs.readFile(
      path.join(tempDir, 'suggested_batch.json'),
      'utf-8'
    );
    const batch = JSON.parse(batchContent);
    expect(batch).toHaveLength(1);
    expect(batch[0].title).toBe('Disk Persist Test');
  });
});

// ─── GET /:slug — Get Single Concept ────────────────────────────────────────

describe('GET /api/admin/photo-concepts/:slug', () => {
  it('should return a concept by slug', async () => {
    // Create one first
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Slug Test Meme', post_type: 'meme_classic' });

    const res = await request(app)
      .get('/api/admin/photo-concepts/slug-test-meme')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('slug-test-meme');
    expect(res.body.title).toBe('Slug Test Meme');
  });

  it('should return 404 for non-existent slug', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts/does-not-exist')
      .set(apiKeyHeader());

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid slug format', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts/INVALID_SLUG!')
      .set(apiKeyHeader());

    expect(res.status).toBe(400);
  });
});

// ─── Route ordering: static routes must not be captured by /:slug ───────────

describe('Route ordering — static before parameterized', () => {
  it('GET /post-types should not be treated as /:slug', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts/post-types')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('postTypes');
    expect(Array.isArray(res.body.postTypes)).toBe(true);
    expect(res.body.postTypes).toContain('meme_classic');
  });

  it('POST /generate-batch should not be treated as /:slug', async () => {
    // This will try to spawn Python (which may not exist in test env),
    // but it should NOT return 400 "Invalid slug" — that would mean
    // it matched the wrong route
    const res = await request(app)
      .post('/api/admin/photo-concepts/generate-batch')
      .set(apiKeyHeader())
      .send({ count: 5 });

    // Either 200 (spawn succeeded) or 500 (Python not found) — but NOT 400
    expect(res.status).not.toBe(400);
  });

  it('POST /assess-all should not be treated as /:slug', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts/assess-all')
      .set(apiKeyHeader());

    // Should be 200 (no concepts to assess) — not 400 or 404
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

// ─── PATCH /:slug — Update Concept ──────────────────────────────────────────

describe('PATCH /api/admin/photo-concepts/:slug', () => {
  it('should update a concept', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Update Me', concept: 'Original text', post_type: 'meme_classic' });

    const res = await request(app)
      .patch('/api/admin/photo-concepts/update-me')
      .set(apiKeyHeader())
      .send({ concept: 'Updated text', tone: 'sarcastic' });

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('update-me');
  });

  it('should return 404 for non-existent concept', async () => {
    const res = await request(app)
      .patch('/api/admin/photo-concepts/nonexistent')
      .set(apiKeyHeader())
      .send({ concept: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('should clear assessment cache on edit', async () => {
    // Create concept
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Score Clear Test' });

    // Manually inject assessment scores into the status file
    const statusPath = path.join(tempDir, 'data', 'photo_status.json');
    const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    if (status['score-clear-test']) {
      status['score-clear-test'].assessment_score = 85;
      status['score-clear-test'].assessment_verdict = 'strong';
      await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
    }

    // Edit the concept — should clear assessment cache
    await request(app)
      .patch('/api/admin/photo-concepts/score-clear-test')
      .set(apiKeyHeader())
      .send({ concept: 'Changed text' });

    // Check that assessment was cleared
    const updatedStatus = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    expect(updatedStatus['score-clear-test']?.assessment_score).toBeUndefined();
    expect(updatedStatus['score-clear-test']?.assessment_verdict).toBeUndefined();
  });
});

// ─── DELETE /:slug ──────────────────────────────────────────────────────────

describe('DELETE /api/admin/photo-concepts/:slug', () => {
  it('should delete a concept', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Delete Me' });

    const res = await request(app)
      .delete('/api/admin/photo-concepts/delete-me')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify it's gone
    const check = await request(app)
      .get('/api/admin/photo-concepts/delete-me')
      .set(apiKeyHeader());
    expect(check.status).toBe(404);
  });

  it('should return 404 for non-existent concept', async () => {
    const res = await request(app)
      .delete('/api/admin/photo-concepts/nonexistent')
      .set(apiKeyHeader());
    expect(res.status).toBe(404);
  });
});

// ─── POST /:slug/approve ───────────────────────────────────────────────────

describe('POST /api/admin/photo-concepts/:slug/approve', () => {
  it('should approve a concept and write to queue', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Approve Me', post_type: 'meme_caption' });

    const res = await request(app)
      .post('/api/admin/photo-concepts/approve-me/approve')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    // Verify queue file was created
    const queueFile = path.join(tempDir, 'data', 'queue', 'approve-me.json');
    const exists = await fs.access(queueFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should return 404 for non-existent concept', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts/nonexistent/approve')
      .set(apiKeyHeader());
    expect(res.status).toBe(404);
  });
});

// ─── POST /:slug/reject ────────────────────────────────────────────────────

describe('POST /api/admin/photo-concepts/:slug/reject', () => {
  it('should reject a concept', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Reject Me' });

    const res = await request(app)
      .post('/api/admin/photo-concepts/reject-me/reject')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  it('should return 404 for non-existent concept', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts/nonexistent/reject')
      .set(apiKeyHeader());
    expect(res.status).toBe(404);
  });
});

// ─── POST /:slug/render ────────────────────────────────────────────────────

describe('POST /api/admin/photo-concepts/:slug/render', () => {
  it('should reject invalid tier', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Render Test' });

    // Approve it first
    await request(app)
      .post('/api/admin/photo-concepts/render-test/approve')
      .set(apiKeyHeader());

    const res = await request(app)
      .post('/api/admin/photo-concepts/render-test/render')
      .set(apiKeyHeader())
      .send({ tier: 'ultra' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tier');
  });

  it('should accept valid tiers: nano, draft, final', async () => {
    for (const tier of ['nano', 'draft', 'final']) {
      const title = `Tier Test ${tier}`;
      await request(app)
        .post('/api/admin/photo-concepts')
        .set(apiKeyHeader())
        .send({ title });

      const slug = title.toLowerCase().replace(/\s+/g, '-');

      // Approve
      await request(app)
        .post(`/api/admin/photo-concepts/${slug}/approve`)
        .set(apiKeyHeader());

      const res = await request(app)
        .post(`/api/admin/photo-concepts/${slug}/render`)
        .set(apiKeyHeader())
        .send({ tier });

      // 200 (spawn works) or 500 (python not found in test) — NOT 400
      expect(res.status).not.toBe(400);
    }
  });

  it('should return 404 for non-existent concept', async () => {
    const res = await request(app)
      .post('/api/admin/photo-concepts/nonexistent/render')
      .set(apiKeyHeader())
      .send({ tier: 'draft' });
    expect(res.status).toBe(404);
  });
});

// ─── GET /:slug/outputs ────────────────────────────────────────────────────

describe('GET /api/admin/photo-concepts/:slug/outputs', () => {
  it('should return empty outputs for concept without renders', async () => {
    await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'No Outputs' });

    const res = await request(app)
      .get('/api/admin/photo-concepts/no-outputs/outputs')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.outputs).toEqual([]);
  });

  it('should list output files when they exist', async () => {
    // Create output dir with fake images
    const outputDir = path.join(tempDir, 'output', 'has-outputs');
    await fs.mkdir(path.join(outputDir, 'twitter'), { recursive: true });
    await fs.writeFile(path.join(outputDir, 'twitter', 'post.png'), 'fake-image');
    await fs.writeFile(path.join(outputDir, 'base.png'), 'fake-base');

    // Create status entry
    const statusPath = path.join(tempDir, 'data', 'photo_status.json');
    await fs.writeFile(statusPath, JSON.stringify({
      'has-outputs': {
        title: 'Has Outputs',
        status: 'rendered',
        post_type: 'meme_classic',
        target_platforms: ['twitter'],
        created_at: new Date().toISOString(),
      },
    }));

    const res = await request(app)
      .get('/api/admin/photo-concepts/has-outputs/outputs')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.outputs.length).toBeGreaterThan(0);
  });
});

// ─── GET /:slug/image/:filename — Image serving ────────────────────────────

describe('GET /api/admin/photo-concepts/:slug/image/:filename', () => {
  it('should serve an image file', async () => {
    const outputDir = path.join(tempDir, 'output', 'image-test');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'test.png'), Buffer.from('fake-png-data'));

    const res = await request(app)
      .get('/api/admin/photo-concepts/image-test/image/test.png')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('should return 404 for non-existent image', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts/image-test/image/nonexistent.png')
      .set(apiKeyHeader());

    expect(res.status).toBe(404);
  });

  it('should block path traversal attempts', async () => {
    const res = await request(app)
      .get('/api/admin/photo-concepts/image-test/image/..%2F..%2Fetc%2Fpasswd')
      .set(apiKeyHeader());

    expect(res.status).toBe(400);
  });
});

// ─── Filesystem error handling ──────────────────────────────────────────────

describe('Filesystem error handling', () => {
  it('should handle missing data directory', async () => {
    await fs.rm(path.join(tempDir, 'data'), { recursive: true, force: true });

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    // Should still work (loadStatus returns {} on error, loadBatch returns [])
    expect(res.status).toBe(200);
  });

  it('should handle PHOTO_PIPELINE_DIR pointing to non-existent path', async () => {
    // NOTE: PHOTO_PIPELINE_DIR is a const resolved at import time, so we can't
    // change it via process.env here. Instead, we simulate the condition by
    // removing the directories the route expects to find.
    await fs.rm(tempDir, { recursive: true, force: true });

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    // Should gracefully return empty, not crash
    expect([200, 500]).toContain(res.status);
  });

  it('should create data directory if it does not exist when saving', async () => {
    await fs.rm(path.join(tempDir, 'data'), { recursive: true, force: true });

    const res = await request(app)
      .post('/api/admin/photo-concepts')
      .set(apiKeyHeader())
      .send({ title: 'Auto Create Dir' });

    // Should succeed — saveStatus uses mkdir recursive
    expect(res.status).toBe(201);
  });
});

// ─── Batch file with control characters (the server error) ─────────────────

describe('Batch file with special characters', () => {
  it('should handle concepts with newlines in text fields', async () => {
    const batch = [
      {
        title: 'Newline Test',
        concept: "Line one\nLine two\nLine three",
        post_type: 'meme_classic',
        target_platforms: ['twitter'],
        tone: 'deadpan',
      },
    ];
    await fs.writeFile(
      path.join(tempDir, 'suggested_batch.json'),
      JSON.stringify(batch)
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.concepts).toHaveLength(1);
  });

  it('should handle concepts with unicode and emoji', async () => {
    const batch = [
      {
        title: 'Emoji Test 🎉',
        concept: 'Testing with émojis and üñíçödé',
        post_type: 'quote_card',
        target_platforms: ['twitter'],
        tone: 'playful',
      },
    ];
    await fs.writeFile(
      path.join(tempDir, 'suggested_batch.json'),
      JSON.stringify(batch)
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.concepts).toHaveLength(1);
  });

  it('should handle batch file with null bytes (the server error)', async () => {
    // This simulates the "Bad control character" error from production
    await fs.writeFile(
      path.join(tempDir, 'suggested_batch.json'),
      '[{"title": "broken\x00concept"}]'
    );

    const res = await request(app)
      .get('/api/admin/photo-concepts')
      .set(apiKeyHeader());

    // Should handle gracefully — either return 200 with empty or 500
    // The key test: does the server crash, or does it handle it?
    expect([200, 500]).toContain(res.status);
  });
});
