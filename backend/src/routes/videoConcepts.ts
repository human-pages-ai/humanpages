import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { jwtOrApiKey, requireStaffOrAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── Path resolution ───
// __dirname = backend/src/routes (or backend/dist/routes) → up 4 to projects/
const VIDEO_PIPELINE_DIR = process.env.VIDEO_PIPELINE_DIR
  || path.resolve(__dirname, '..', '..', '..', '..', 'video-pipeline');
const CONCEPTS_DIR = path.join(VIDEO_PIPELINE_DIR, 'concepts');
const STATUS_FILE = path.join(CONCEPTS_DIR, 'status.json');
const DATA_CONCEPTS_DIR = path.join(VIDEO_PIPELINE_DIR, 'data', 'concepts');

// ─── Pricing — synced with video-pipeline/schemas/pipeline.py ───
const PRICING = {
  images: {
    flux_schnell: 0.003,       // $/image (fixed)
    flux_pro_per_mp: 0.04,     // $/megapixel
  },
  video: {
    kling: 0.07,               // $/second
    hailuo_512p: 0.017,        // $/second
    runway: 0.05,              // $/second
  },
} as const;

const TIER_PROVIDERS = {
  nano:  { image: 'flux_schnell', hookVideo: null, fillVideo: null },
  draft: { image: 'flux_schnell', hookVideo: 'kling', fillVideo: 'hailuo_512p' },
  final: { image: 'flux_pro',     hookVideo: 'kling', fillVideo: 'kling' },
} as const;

// In-memory set to prevent concurrent regen on same scene
const regenInProgress = new Set<string>();

// ─── Auth: jwtOrApiKey, then require admin for JWT users ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  // If userId is set, JWT was used — require admin role
  if (authReq.userId) {
    return requireStaffOrAdmin(authReq, res, next);
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

// ─── Job endpoints (before /:slug to avoid collision) ───

// GET /jobs — List recent parent jobs with step children
router.get('/jobs', async (_req, res) => {
  try {
    const jobs = await prisma.videoJob.findMany({
      where: { parentJobId: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        stepJobs: { orderBy: { stepNumber: 'asc' } },
      },
    });
    res.json({ jobs });
  } catch (error) {
    logger.error({ err: error }, 'Video jobs list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /job/:jobId — Get single job status
router.get('/job/:jobId', async (req, res) => {
  try {
    const job = await prisma.videoJob.findUnique({
      where: { id: req.params.jobId },
      include: {
        stepJobs: { orderBy: { stepNumber: 'asc' } },
      },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    logger.error({ err: error }, 'Video job get error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /job/:jobId/cancel — Cancel a job (parent cascades to step children)
router.post('/job/:jobId/cancel', async (req, res) => {
  try {
    const job = await prisma.videoJob.findUnique({
      where: { id: req.params.jobId },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (!['PENDING', 'RUNNING', 'CHECKPOINT'].includes(job.status)) {
      return res.status(400).json({ error: `Cannot cancel job with status ${job.status}` });
    }
    const now = new Date();
    const updated = await prisma.videoJob.update({
      where: { id: job.id },
      data: { status: 'CANCELLED', completedAt: now },
    });
    // If this is a parent job, also cancel PENDING step children
    if (!job.parentJobId) {
      await prisma.videoJob.updateMany({
        where: {
          parentJobId: job.id,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED', completedAt: now },
      });
    }
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Video job cancel error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /:slug/preview — Queue a nano preview job (parent + step 1)
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

    // Check for existing PENDING/RUNNING preview parent job
    const existing = await prisma.videoJob.findFirst({
      where: {
        conceptSlug: slug,
        jobType: 'PREVIEW',
        parentJobId: null,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: 'A preview job is already queued or running',
        jobId: existing.id,
      });
    }

    // Create parent job (RUNNING) + step 1 (PENDING)
    const parent = await prisma.videoJob.create({
      data: {
        conceptSlug: slug,
        jobType: 'PREVIEW',
        tier: 'nano',
        status: 'RUNNING',
        pipelineStep: 'queued',
        progressPct: 0,
      },
    });

    await prisma.videoJob.create({
      data: {
        conceptSlug: slug,
        jobType: 'PREVIEW',
        tier: 'nano',
        stepNumber: 1,
        stepName: 'script',
        parentJobId: parent.id,
      },
    });

    logger.info({ slug, jobId: parent.id }, 'Video concept preview job queued');
    res.json({ message: `Preview queued for '${slug}'`, jobId: parent.id });
  } catch (error) {
    logger.error({ err: error }, 'Video concept preview error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /:slug/produce — Queue a production job (reuses nano script if available)
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

    const tier = status[slug].approved_tier || 'draft';

    // Check for existing PENDING/RUNNING/CHECKPOINT produce parent job
    const existing = await prisma.videoJob.findFirst({
      where: {
        conceptSlug: slug,
        jobType: 'PRODUCE',
        parentJobId: null,
        status: { in: ['PENDING', 'RUNNING', 'CHECKPOINT'] },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: 'A production job is already queued or running',
        jobId: existing.id,
      });
    }

    // Try to reuse nano script
    const nanoScriptPath = path.join(DATA_CONCEPTS_DIR, slug, 'nano', 'script.json');
    let startStep = 1;
    let startStepName = 'script';

    try {
      await fs.access(nanoScriptPath);
      // Copy nano script to production tier dir
      const tierDir = path.join(DATA_CONCEPTS_DIR, slug, tier);
      await fs.mkdir(tierDir, { recursive: true });
      await fs.copyFile(nanoScriptPath, path.join(tierDir, 'script.json'));
      startStep = 2;
      startStepName = 'images';
      logger.info({ slug, tier }, 'Reusing nano script for production');
    } catch {
      // No nano script — start from step 1
    }

    // Create parent job (RUNNING) + first step (PENDING)
    const parent = await prisma.videoJob.create({
      data: {
        conceptSlug: slug,
        jobType: 'PRODUCE',
        tier,
        status: 'RUNNING',
        pipelineStep: 'queued',
        progressPct: 0,
      },
    });

    await prisma.videoJob.create({
      data: {
        conceptSlug: slug,
        jobType: 'PRODUCE',
        tier,
        stepNumber: startStep,
        stepName: startStepName,
        parentJobId: parent.id,
      },
    });

    logger.info({ slug, jobId: parent.id, tier, startStep }, 'Video concept produce job queued');
    res.json({ message: `Production queued for '${slug}'`, jobId: parent.id });
  } catch (error) {
    logger.error({ err: error }, 'Video concept produce error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /:slug/jobs — List recent jobs for a concept
router.get('/:slug/jobs', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }
    const jobs = await prisma.videoJob.findMany({
      where: { conceptSlug: slug },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ jobs });
  } catch (error) {
    logger.error({ err: error }, 'Video concept jobs list error');
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
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /:slug/image/:tier/:filename — Serve scene image from disk
router.get('/:slug/image/:tier/:filename', async (req, res) => {
  try {
    const { slug, tier, filename } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }
    if (!['nano', 'draft', 'final'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }
    if (!/^scene_\d{2}\.png$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(DATA_CONCEPTS_DIR, slug, tier, 'images', filename);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  } catch (error) {
    logger.error({ err: error }, 'Video concept image error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug/script/:tier — Return parsed script.json
router.get('/:slug/script/:tier', async (req, res) => {
  try {
    const { slug, tier } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }
    if (!['nano', 'draft', 'final'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const scriptPath = path.join(DATA_CONCEPTS_DIR, slug, tier, 'script.json');
    let data: string;
    try {
      data = await fs.readFile(scriptPath, 'utf-8');
    } catch {
      return res.status(404).json({ error: 'Script not found' });
    }

    res.json(JSON.parse(data));
  } catch (error) {
    logger.error({ err: error }, 'Video concept script error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/reject — Reset concept to 'new'
router.post('/:slug/reject', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    const status = await loadStatus();
    if (!status[slug]) {
      return res.status(404).json({ error: 'Concept not found in status' });
    }

    status[slug].status = 'new';
    status[slug].approved_tier = null;
    await saveStatus(status);

    res.json({ slug, status: 'new' });
  } catch (error) {
    logger.error({ err: error }, 'Video concept reject error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/continue — Resume production from CHECKPOINT
router.post('/:slug/continue', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    // Find the CHECKPOINT parent job for this slug
    const parentJob = await prisma.videoJob.findFirst({
      where: {
        conceptSlug: slug,
        parentJobId: null,
        status: 'CHECKPOINT',
      },
      orderBy: { createdAt: 'desc' },
      include: { stepJobs: true },
    });

    if (!parentJob) {
      return res.status(404).json({ error: 'No checkpoint job found' });
    }

    // Guard: reject if any step is currently RUNNING
    const runningStep = parentJob.stepJobs?.find(s => s.status === 'RUNNING');
    if (runningStep) {
      return res.status(409).json({ error: 'A step is already running', stepNumber: runningStep.stepNumber });
    }

    const tier = parentJob.tier;
    const stepNames: Record<number, string> = { 1: 'script', 2: 'images', 3: 'animate', 4: 'voiceover', 5: 'compose' };

    // Derive next step from last COMPLETED step
    const completedSteps = (parentJob.stepJobs || [])
      .filter(s => s.status === 'COMPLETED')
      .sort((a, b) => (b.stepNumber || 0) - (a.stepNumber || 0));
    const lastCompletedStep = completedSteps[0]?.stepNumber || 2;
    const nextStep = lastCompletedStep + 1;

    if (nextStep > 5) {
      return res.status(400).json({ error: 'No more steps to run' });
    }

    // Create next step job under same parent
    await prisma.videoJob.create({
      data: {
        conceptSlug: slug,
        jobType: parentJob.jobType,
        tier,
        stepNumber: nextStep,
        stepName: stepNames[nextStep],
        parentJobId: parentJob.id,
      },
    });

    // Set parent back to RUNNING
    const stepPct: Record<number, number> = { 3: 40, 4: 60, 5: 80 };
    await prisma.videoJob.update({
      where: { id: parentJob.id },
      data: {
        status: 'RUNNING',
        pipelineStep: `step ${nextStep}: ${stepNames[nextStep]}`,
        progressPct: stepPct[nextStep] || 40,
      },
    });

    // Update concept status
    const status = await loadStatus();
    if (status[slug]) {
      status[slug].status = `${tier}_in_production`;
      await saveStatus(status);
    }

    res.json({ message: `Resumed production for '${slug}'`, jobId: parentJob.id });
  } catch (error) {
    logger.error({ err: error }, 'Video concept continue error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:slug/regenerate-image/:tier/:sceneNum — Regenerate one scene image
router.post('/:slug/regenerate-image/:tier/:sceneNum', async (req, res) => {
  const { slug, tier, sceneNum } = req.params;
  if (!isValidSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
  if (!['nano', 'draft', 'final'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
  const num = parseInt(sceneNum, 10);
  if (isNaN(num) || num < 1 || num > 20) return res.status(400).json({ error: 'Invalid scene number' });

  const lockKey = `${slug}:${tier}:${num}`;
  if (regenInProgress.has(lockKey)) {
    return res.status(409).json({ error: 'Regeneration already in progress for this scene' });
  }

  const scriptPath = path.join(DATA_CONCEPTS_DIR, slug, tier, 'script.json');
  try { await fs.access(scriptPath); } catch {
    return res.status(404).json({ error: 'Script not found for this tier' });
  }

  // Delete existing image so step2 regenerates it
  const imagePath = path.join(DATA_CONCEPTS_DIR, slug, tier, 'images', `scene_${String(num).padStart(2, '0')}.png`);
  try { await fs.unlink(imagePath); } catch { /* may not exist */ }

  regenInProgress.add(lockKey);
  const pythonScript = path.join(VIDEO_PIPELINE_DIR, 'regenerate_scene.py');
  const venvPython = path.join(VIDEO_PIPELINE_DIR, 'venv', 'bin', 'python3');

  execFile(venvPython, [pythonScript, slug, tier, String(num)], {
    cwd: VIDEO_PIPELINE_DIR,
    timeout: 120000,
    env: { ...process.env, PYTHONPATH: VIDEO_PIPELINE_DIR },
  }, (error, stdout, stderr) => {
    regenInProgress.delete(lockKey);
    if (error) {
      logger.error({ slug, tier, sceneNum: num, error: stderr }, 'Regenerate image failed');
      return res.status(500).json({ error: 'Image regeneration failed', detail: stderr.slice(-500) });
    }
    try {
      const result = JSON.parse(stdout);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, scene: num });
    } catch {
      res.json({ success: true, scene: num });
    }
  });
});

// GET /:slug/cost-estimate/:tier — Estimate production cost
router.get('/:slug/cost-estimate/:tier', async (req, res) => {
  try {
    const { slug, tier } = req.params;
    if (!['nano', 'draft', 'final'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }
    const providers = TIER_PROVIDERS[tier as keyof typeof TIER_PROVIDERS];

    // Read script.json (try production tier first, then nano)
    let numScenes = 0, totalDuration = 0;
    let scriptFound = false;
    for (const t of [tier, 'nano']) {
      try {
        const scriptPath = path.join(DATA_CONCEPTS_DIR, slug, t, 'script.json');
        const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));
        numScenes = script.scenes?.length || 8;
        totalDuration = script.total_duration_seconds || 40;
        scriptFound = true;
        break;
      } catch { /* try next */ }
    }
    if (!scriptFound) {
      return res.status(404).json({ error: 'No script found — run a preview first' });
    }

    const avgClipSec = totalDuration / numScenes;

    // Image cost
    let imageCost = 0;
    if (providers.image === 'flux_schnell') {
      imageCost = numScenes * PRICING.images.flux_schnell;
    } else {
      imageCost = numScenes * Math.ceil(1080 * 1920 / 1e6) * PRICING.images.flux_pro_per_mp;
    }

    // Video cost
    let videoCost = 0;
    if (providers.hookVideo && providers.fillVideo) {
      const hookRate = PRICING.video[providers.hookVideo as keyof typeof PRICING.video] || 0;
      const fillRate = PRICING.video[providers.fillVideo as keyof typeof PRICING.video] || 0;
      videoCost = avgClipSec * hookRate + (numScenes - 1) * avgClipSec * fillRate;
    }

    const total = imageCost + videoCost;
    res.json({
      tier,
      numScenes,
      totalDuration,
      breakdown: { images: +imageCost.toFixed(3), video: +videoCost.toFixed(2), voiceover: 0 },
      total: +total.toFixed(2),
      totalWithRetries: +(total * 1.5).toFixed(2),
    });
  } catch (error) {
    logger.error({ err: error }, 'Video concept cost estimate error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:slug/script/:tier — Save edited script
router.put('/:slug/script/:tier', async (req, res) => {
  try {
    const { slug, tier } = req.params;
    if (!isValidSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
    if (!['nano', 'draft', 'final'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

    const script = req.body;
    if (!script || !script.title || !script.scenes || !Array.isArray(script.scenes) || script.scenes.length === 0) {
      return res.status(400).json({ error: 'Invalid script: must have title and at least one scene' });
    }
    for (const scene of script.scenes) {
      if (typeof scene.scene_number !== 'number' || typeof scene.duration_seconds !== 'number') {
        return res.status(400).json({ error: 'Invalid scene: missing scene_number or duration_seconds' });
      }
    }

    const tierDir = path.join(DATA_CONCEPTS_DIR, slug, tier);
    const scriptPath = path.join(tierDir, 'script.json');

    await fs.mkdir(tierDir, { recursive: true });

    // Backup existing script before overwriting
    try {
      await fs.access(scriptPath);
      const backupPath = path.join(tierDir, `script.${Date.now()}.bak.json`);
      await fs.copyFile(scriptPath, backupPath);
    } catch { /* no existing script to back up */ }

    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Video concept save script error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
