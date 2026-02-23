import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Path resolution ───
const VIDEO_PIPELINE_DIR = process.env.VIDEO_PIPELINE_DIR
  || path.resolve(process.cwd(), '../video-pipeline');
const CONCEPTS_DIR = path.join(VIDEO_PIPELINE_DIR, 'concepts');
const STATUS_FILE = path.join(CONCEPTS_DIR, 'status.json');
const DATA_CONCEPTS_DIR = path.join(VIDEO_PIPELINE_DIR, 'data', 'concepts');

// ─── Auth: jwtOrApiKey, then require admin for JWT users ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  // If userId is set, JWT was used — require admin role
  if (authReq.userId) {
    return requireAdmin(authReq, res, next);
  }
  // API key already validated
  next();
});

// ─── Helpers ───

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug) || /^[a-z0-9]{1,2}$/.test(slug);
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};
  let body = content;

  if (content.startsWith('---')) {
    const parts = content.split('---', 3);
    if (parts.length >= 3) {
      const yamlText = parts[1].trim();
      body = parts[2].trim();

      for (const line of yamlText.split('\n')) {
        const trimmed = line.trim();
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const val = trimmed.slice(colonIdx + 1).trim();
          frontmatter[key] = val;
        }
      }
    }
  }

  return { frontmatter, body };
}

function serializeConcept(frontmatter: Record<string, string>, body: string): string {
  const lines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}

async function loadStatus(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveStatus(status: Record<string, any>): Promise<void> {
  await fs.mkdir(CONCEPTS_DIR, { recursive: true });
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function syncStatus(): Promise<Record<string, any>> {
  const status = await loadStatus();

  try {
    const files = await fs.readdir(CONCEPTS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();

    for (const file of mdFiles) {
      const slug = file.replace(/\.md$/, '');
      if (!status[slug]) {
        const content = await fs.readFile(path.join(CONCEPTS_DIR, file), 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        status[slug] = {
          file: `concepts/${file}`,
          title: frontmatter.title || slug,
          status: 'new',
          nano_dir: null,
          approved_tier: null,
        };
      }
    }
  } catch {
    // concepts/ dir may not exist yet
  }

  await saveStatus(status);
  return status;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─── Endpoints ───

// GET / — List all concepts
router.get('/', async (_req, res) => {
  try {
    const status = await syncStatus();
    const concepts = [];

    for (const [slug, entry] of Object.entries(status)) {
      let frontmatter: Record<string, string> = {};
      try {
        const content = await fs.readFile(path.join(CONCEPTS_DIR, `${slug}.md`), 'utf-8');
        ({ frontmatter } = parseFrontmatter(content));
      } catch { /* file may be missing */ }

      concepts.push({
        slug,
        title: entry.title || frontmatter.title || slug,
        status: entry.status,
        duration: frontmatter.duration || '',
        style: frontmatter.style || '',
        approvedTier: entry.approved_tier || null,
        nanoDir: entry.nano_dir || null,
      });
    }

    res.json({ concepts });
  } catch (error) {
    logger.error({ err: error }, 'Video concepts list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug — Get a single concept
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const status = await loadStatus();
    const entry = status[slug];

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return res.status(404).json({ error: 'Concept not found' });
    }

    const { frontmatter, body } = parseFrontmatter(content);

    res.json({
      slug,
      title: entry?.title || frontmatter.title || slug,
      status: entry?.status || 'new',
      duration: frontmatter.duration || '',
      style: frontmatter.style || '',
      body,
      approvedTier: entry?.approved_tier || null,
      nanoDir: entry?.nano_dir || null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Video concept get error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — Create a new concept
router.post('/', async (req, res) => {
  try {
    const { title, slug: rawSlug, duration, style, body } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!body || typeof body !== 'string') {
      return res.status(400).json({ error: 'body is required' });
    }

    const slug = rawSlug ? String(rawSlug) : slugify(title);
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug (alphanumeric + hyphens, 2-80 chars)' });
    }

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);
    try {
      await fs.access(filePath);
      return res.status(409).json({ error: `Concept '${slug}' already exists` });
    } catch { /* good — file doesn't exist */ }

    const frontmatter: Record<string, string> = { title };
    if (duration) frontmatter.duration = String(duration);
    if (style) frontmatter.style = String(style);

    const content = serializeConcept(frontmatter, body);
    await fs.mkdir(CONCEPTS_DIR, { recursive: true });
    await fs.writeFile(filePath, content);

    // Update status.json
    const status = await loadStatus();
    status[slug] = {
      file: `concepts/${slug}.md`,
      title,
      status: 'new',
      nano_dir: null,
      approved_tier: null,
    };
    await saveStatus(status);

    res.status(201).json({
      slug,
      title,
      status: 'new',
      duration: duration || '',
      style: style || '',
      body,
      approvedTier: null,
      nanoDir: null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Video concept create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:slug — Update a concept
router.patch('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return res.status(404).json({ error: 'Concept not found' });
    }

    const { frontmatter, body: existingBody } = parseFrontmatter(content);
    const { title, duration, style, body } = req.body;

    if (title !== undefined) frontmatter.title = String(title);
    if (duration !== undefined) frontmatter.duration = String(duration);
    if (style !== undefined) frontmatter.style = String(style);

    const newBody = body !== undefined ? String(body) : existingBody;
    const newContent = serializeConcept(frontmatter, newBody);
    await fs.writeFile(filePath, newContent);

    // Update title in status.json
    const status = await loadStatus();
    if (status[slug] && title !== undefined) {
      status[slug].title = String(title);
      await saveStatus(status);
    }

    res.json({
      slug,
      title: frontmatter.title || slug,
      status: status[slug]?.status || 'new',
      duration: frontmatter.duration || '',
      style: frontmatter.style || '',
      body: newBody,
      approvedTier: status[slug]?.approved_tier || null,
      nanoDir: status[slug]?.nano_dir || null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Video concept update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:slug — Delete a concept
router.delete('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);
    try {
      await fs.unlink(filePath);
    } catch {
      return res.status(404).json({ error: 'Concept not found' });
    }

    // Remove from status.json
    const status = await loadStatus();
    delete status[slug];
    await saveStatus(status);

    res.json({ message: `Concept '${slug}' deleted` });
  } catch (error) {
    logger.error({ err: error }, 'Video concept delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/preview — Trigger nano preview (spawns background process)
router.post('/:slug/preview', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Concept not found' });
    }

    // Spawn in background
    const child = spawn('python3', ['concept.py', '--preview', slug], {
      cwd: VIDEO_PIPELINE_DIR,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();

    logger.info({ slug, pid: child.pid }, 'Video concept preview spawned');
    res.json({ message: `Preview started for '${slug}'`, pid: child.pid });
  } catch (error) {
    logger.error({ err: error }, 'Video concept preview error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/approve — Approve a concept
router.post('/:slug/approve', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const tier = req.body.tier || 'draft';
    if (!['draft', 'final'].includes(tier)) {
      return res.status(400).json({ error: 'tier must be "draft" or "final"' });
    }

    const status = await loadStatus();
    if (!status[slug]) {
      return res.status(404).json({ error: 'Concept not found in status' });
    }

    status[slug].status = 'approved';
    status[slug].approved_tier = tier;
    await saveStatus(status);

    res.json({
      slug,
      status: 'approved',
      approvedTier: tier,
    });
  } catch (error) {
    logger.error({ err: error }, 'Video concept approve error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/produce — Trigger production (spawns background process)
router.post('/:slug/produce', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const status = await loadStatus();
    if (!status[slug]) {
      return res.status(404).json({ error: 'Concept not found in status' });
    }

    // Spawn in background
    const child = spawn('python3', ['concept.py', '--produce'], {
      cwd: VIDEO_PIPELINE_DIR,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();

    logger.info({ slug, pid: child.pid }, 'Video concept produce spawned');
    res.json({ message: `Production started`, pid: child.pid });
  } catch (error) {
    logger.error({ err: error }, 'Video concept produce error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug/outputs — List output files
router.get('/:slug/outputs', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const outputDir = path.join(DATA_CONCEPTS_DIR, slug);
    const outputs: { tier: string; files: string[] }[] = [];

    try {
      const tiers = await fs.readdir(outputDir);
      for (const tier of tiers) {
        const tierPath = path.join(outputDir, tier);
        const stat = await fs.stat(tierPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(tierPath);
          outputs.push({ tier, files: files.sort() });
        }
      }
    } catch {
      // No output directory yet
    }

    res.json({ slug, outputs });
  } catch (error) {
    logger.error({ err: error }, 'Video concept outputs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
