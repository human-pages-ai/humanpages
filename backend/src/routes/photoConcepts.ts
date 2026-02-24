import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Path resolution ───
const PHOTO_PIPELINE_DIR = process.env.PHOTO_PIPELINE_DIR
  || path.resolve(__dirname, '..', '..', '..', '..', 'photo-pipeline');
const DATA_DIR = path.join(PHOTO_PIPELINE_DIR, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'photo_status.json');
const BATCH_FILE = path.join(PHOTO_PIPELINE_DIR, 'suggested_batch.json');
const QUEUE_DIR = path.join(DATA_DIR, 'queue');
const OUTPUT_DIR = path.join(PHOTO_PIPELINE_DIR, 'output');

// ─── Auth ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  if (authReq.userId) {
    return requireAdmin(authReq, res, next);
  }
  next();
});

// ─── Helpers ───

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug) || /^[a-z0-9]{1,2}$/.test(slug);
}

interface PhotoStatus {
  [slug: string]: {
    title: string;
    status: 'new' | 'approved' | 'rendered' | 'rejected';
    post_type: string;
    target_platforms: string[];
    created_at: string;
    approved_at?: string;
    rendered_at?: string;
  };
}

async function loadStatus(): Promise<PhotoStatus> {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveStatus(status: PhotoStatus): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function loadBatch(): Promise<any[]> {
  try {
    const data = await fs.readFile(BATCH_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function syncStatus(): Promise<PhotoStatus> {
  const status = await loadStatus();
  const batch = await loadBatch();

  for (const concept of batch) {
    const slug = slugify(concept.title || '');
    if (!slug) continue;
    if (!status[slug]) {
      status[slug] = {
        title: concept.title || slug,
        status: 'new',
        post_type: concept.post_type || '',
        target_platforms: concept.target_platforms || [],
        created_at: new Date().toISOString(),
      };
    }
  }

  // Also check queue dir for approved concepts
  try {
    const queueFiles = await fs.readdir(QUEUE_DIR);
    for (const file of queueFiles.filter(f => f.endsWith('.json'))) {
      const slug = file.replace(/\.json$/, '');
      if (status[slug] && status[slug].status === 'new') {
        status[slug].status = 'approved';
      }
    }
  } catch { /* queue dir may not exist */ }

  // Check output dir for rendered concepts
  try {
    const outputFiles = await fs.readdir(OUTPUT_DIR);
    for (const dir of outputFiles) {
      const slug = dir;
      if (status[slug] && status[slug].status === 'approved') {
        const outputPath = path.join(OUTPUT_DIR, dir);
        const stat = await fs.stat(outputPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(outputPath);
          if (files.length > 0) {
            status[slug].status = 'rendered';
          }
        }
      }
    }
  } catch { /* output dir may not exist */ }

  await saveStatus(status);
  return status;
}

// ─── Endpoints ───

// GET / — List all photo concepts
router.get('/', async (_req, res) => {
  try {
    const status = await syncStatus();
    const batch = await loadBatch();

    // Build a map of batch concepts by slug for quick lookup
    const batchMap = new Map<string, any>();
    for (const concept of batch) {
      const slug = slugify(concept.title || '');
      if (slug) batchMap.set(slug, concept);
    }

    const concepts = [];
    for (const [slug, entry] of Object.entries(status)) {
      const batchConcept = batchMap.get(slug);
      concepts.push({
        slug,
        title: entry.title,
        status: entry.status,
        postType: entry.post_type || batchConcept?.post_type || '',
        targetPlatforms: entry.target_platforms || batchConcept?.target_platforms || [],
        concept: batchConcept?.concept || '',
        tone: batchConcept?.tone || '',
        createdAt: entry.created_at,
      });
    }

    res.json({ concepts });
  } catch (error) {
    logger.error({ err: error }, 'Photo concepts list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug — Get a single photo concept with full details
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const status = await loadStatus();
    const batch = await loadBatch();

    const entry = status[slug];
    const batchConcept = batch.find(c => slugify(c.title || '') === slug);

    if (!entry && !batchConcept) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    res.json({
      slug,
      title: entry?.title || batchConcept?.title || slug,
      status: entry?.status || 'new',
      postType: batchConcept?.post_type || entry?.post_type || '',
      targetPlatforms: batchConcept?.target_platforms || entry?.target_platforms || [],
      concept: batchConcept?.concept || '',
      tone: batchConcept?.tone || '',
      imagePrompt: batchConcept?.image_prompt || '',
      imageStyle: batchConcept?.image_style || '',
      captionText: batchConcept?.caption_text || '',
      bodyText: batchConcept?.body_text || '',
      topText: batchConcept?.top_text || '',
      bottomText: batchConcept?.bottom_text || '',
      statValue: batchConcept?.stat_value || '',
      statLabel: batchConcept?.stat_label || '',
      quoteText: batchConcept?.quote_text || '',
      quoteAttribution: batchConcept?.quote_attribution || '',
      jobTitle: batchConcept?.job_title || '',
      jobDescription: batchConcept?.job_description || '',
      jobBudget: batchConcept?.job_budget || '',
      pillar: batchConcept?.pillar || '',
      hashtags: batchConcept?.hashtags || [],
      fontStyle: batchConcept?.font_style || 'sans',
      accentColor: batchConcept?.accent_color || '#00d2ff',
      needsImage: batchConcept?.needs_image ?? true,
      createdAt: entry?.created_at || new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept get error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — Create a new photo concept (add to batch)
router.post('/', async (req, res) => {
  try {
    const { title, post_type, target_platforms, concept: conceptText, tone, image_prompt, body_text, caption_text } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }

    const slug = slugify(title);
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Generated slug is invalid' });
    }

    const batch = await loadBatch();

    // Check for duplicate
    if (batch.some(c => slugify(c.title || '') === slug)) {
      return res.status(409).json({ error: `Concept '${slug}' already exists` });
    }

    const newConcept: any = {
      title,
      concept: conceptText || '',
      post_type: post_type || 'meme_caption',
      target_platforms: target_platforms || ['twitter', 'instagram', 'facebook'],
      tone: tone || 'deadpan',
      image_prompt: image_prompt || '(no prompt)',
      image_style: 'photorealistic',
      aspect_ratio: '1:1',
      needs_image: true,
      body_text: body_text || null,
      caption_text: caption_text || null,
      pillar: '',
      hashtags: [],
      font_style: 'sans',
      text_color: '#FFFFFF',
      stroke_color: '#000000',
      accent_color: '#00d2ff',
      watermark: '@humanpages',
      brand_name: 'humanpages.ai',
      tagline: 'Your work. Your earnings. Your page.',
      show_logo: false,
    };

    batch.push(newConcept);
    await fs.writeFile(BATCH_FILE, JSON.stringify(batch, null, 2));

    // Update status
    const status = await loadStatus();
    status[slug] = {
      title,
      status: 'new',
      post_type: newConcept.post_type,
      target_platforms: newConcept.target_platforms,
      created_at: new Date().toISOString(),
    };
    await saveStatus(status);

    res.status(201).json({
      slug,
      title,
      status: 'new',
      postType: newConcept.post_type,
      targetPlatforms: newConcept.target_platforms,
      concept: newConcept.concept,
      tone: newConcept.tone,
      createdAt: status[slug].created_at,
    });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:slug — Update a photo concept
router.patch('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const batch = await loadBatch();
    const idx = batch.findIndex(c => slugify(c.title || '') === slug);

    if (idx === -1) {
      return res.status(404).json({ error: 'Concept not found in batch' });
    }

    // Merge updates
    const allowed = ['title', 'concept', 'post_type', 'target_platforms', 'tone', 'image_prompt', 'image_style', 'body_text', 'caption_text', 'top_text', 'bottom_text', 'stat_value', 'stat_label', 'quote_text', 'quote_attribution', 'job_title', 'job_description', 'job_budget', 'pillar', 'hashtags', 'font_style', 'accent_color'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        batch[idx][key] = req.body[key];
      }
    }

    await fs.writeFile(BATCH_FILE, JSON.stringify(batch, null, 2));

    // Update status title if changed
    const status = await loadStatus();
    if (status[slug] && req.body.title) {
      status[slug].title = req.body.title;
    }
    if (status[slug] && req.body.post_type) {
      status[slug].post_type = req.body.post_type;
    }
    await saveStatus(status);

    res.json({
      slug,
      title: batch[idx].title,
      status: status[slug]?.status || 'new',
      postType: batch[idx].post_type,
      concept: batch[idx].concept,
    });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:slug — Delete a photo concept
router.delete('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const batch = await loadBatch();
    const idx = batch.findIndex(c => slugify(c.title || '') === slug);

    if (idx === -1) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    batch.splice(idx, 1);
    await fs.writeFile(BATCH_FILE, JSON.stringify(batch, null, 2));

    const status = await loadStatus();
    delete status[slug];
    await saveStatus(status);

    res.json({ message: `Concept '${slug}' deleted` });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/approve — Approve a concept (copy to queue)
router.post('/:slug/approve', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const batch = await loadBatch();
    const concept = batch.find(c => slugify(c.title || '') === slug);

    if (!concept) {
      return res.status(404).json({ error: 'Concept not found in batch' });
    }

    // Write to queue dir
    await fs.mkdir(QUEUE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(QUEUE_DIR, `${slug}.json`),
      JSON.stringify(concept, null, 2)
    );

    // Update status
    const status = await loadStatus();
    if (!status[slug]) {
      status[slug] = {
        title: concept.title,
        status: 'approved',
        post_type: concept.post_type,
        target_platforms: concept.target_platforms,
        created_at: new Date().toISOString(),
      };
    }
    status[slug].status = 'approved';
    status[slug].approved_at = new Date().toISOString();
    await saveStatus(status);

    res.json({ slug, status: 'approved' });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept approve error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/render — Trigger rendering (spawn background process)
router.post('/:slug/render', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const status = await loadStatus();
    if (!status[slug]) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    // Spawn pipeline in background
    const child = spawn('python3', ['pipeline.py', '--from-queue'], {
      cwd: PHOTO_PIPELINE_DIR,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();

    logger.info({ slug, pid: child.pid }, 'Photo concept render spawned');
    res.json({ message: `Render started`, pid: child.pid });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept render error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate-batch — Trigger batch concept generation
router.post('/generate-batch', async (req, res) => {
  try {
    const count = req.body.count || 10;

    const child = spawn('python3', ['batch_concepts.py', '--count', String(count)], {
      cwd: PHOTO_PIPELINE_DIR,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();

    logger.info({ count, pid: child.pid }, 'Photo batch generation spawned');
    res.json({ message: `Batch generation started (${count} concepts)`, pid: child.pid });
  } catch (error) {
    logger.error({ err: error }, 'Photo batch generation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug/outputs — List output files for a concept
router.get('/:slug/outputs', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const outputs: { platform: string; files: string[] }[] = [];

    try {
      const outputPath = path.join(OUTPUT_DIR, slug);
      const entries = await fs.readdir(outputPath);
      for (const entry of entries) {
        const entryPath = path.join(outputPath, entry);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(entryPath);
          outputs.push({ platform: entry, files: files.sort() });
        } else if (entry.endsWith('.png') || entry.endsWith('.jpg')) {
          // Root-level output files
          if (!outputs.find(o => o.platform === 'default')) {
            outputs.push({ platform: 'default', files: [] });
          }
          outputs.find(o => o.platform === 'default')!.files.push(entry);
        }
      }
    } catch { /* No output directory yet */ }

    res.json({ slug, outputs });
  } catch (error) {
    logger.error({ err: error }, 'Photo concept outputs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
