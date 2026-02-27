import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { jwtOrApiKey, requireAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Helper function ───
function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── Path resolution ───
const VIDEO_PIPELINE_DIR = process.env.VIDEO_PIPELINE_DIR
  || path.resolve(__dirname, '..', '..', '..', '..', 'video-pipeline');
const BATCHES_DIR = path.join(VIDEO_PIPELINE_DIR, 'data', 'batches');
const APPROVED_FILE = path.join(VIDEO_PIPELINE_DIR, 'data', 'approved.json');

// ─── Auth: jwtOrApiKey, then require admin for JWT users ───
router.use(jwtOrApiKey);
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  if (authReq.userId) {
    return requireAdmin(authReq, res, next);
  }
  next();
});

// ─── Approved state helpers ───
interface ApprovedEntry {
  date: string;
  concept: number;
  title: string;
  tier: string;
  approvedAt: string;
}

async function loadApproved(): Promise<ApprovedEntry[]> {
  try {
    const raw = await fs.readFile(APPROVED_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveApproved(entries: ApprovedEntry[]): Promise<void> {
  await fs.writeFile(APPROVED_FILE, JSON.stringify(entries, null, 2));
}

// ─── Batch listing helpers ───
interface ManifestConcept {
  concept_number: number;
  title: string;
  concept: string;
  hook: string;
  pillar: string;
  thumbnail_paths: string[];
  script_path: string;
  data_dir: string;
}

interface BatchManifest {
  batch_date: string;
  batch_dir: string;
  count: number;
  tier: string;
  concepts: ManifestConcept[];
}

async function loadManifest(date: string): Promise<BatchManifest | null> {
  try {
    const manifestPath = path.join(BATCHES_DIR, date, 'manifest.json');
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET / — List all batch dates ───
router.get('/', async (_req, res) => {
  try {
    let entries: string[];
    try {
      entries = await fs.readdir(BATCHES_DIR);
    } catch {
      return res.json({ batches: [] });
    }

    // Filter to date-like directories (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateDirs = entries.filter(e => datePattern.test(e)).sort().reverse();

    const approved = await loadApproved();

    const batches = await Promise.all(dateDirs.map(async (date) => {
      const manifest = await loadManifest(date);
      const approvedForDate = approved.filter(a => a.date === date);
      const conceptCount = manifest?.count ?? 0;
      const validConcepts = manifest?.concepts?.filter(c => c.hook && c.pillar).length ?? 0;

      return {
        date,
        conceptCount,
        validConcepts,
        approvedCount: approvedForDate.length,
        tier: manifest?.tier ?? 'nano',
        approvedTier: approvedForDate.length > 0 ? approvedForDate[0].tier : null,
      };
    }));

    res.json({ batches });
  } catch (err) {
    logger.error({ err }, 'Failed to list batches');
    res.status(500).json({ error: 'Failed to list batches', detail: errMsg(err) });
  }
});

// ─── GET /queue — Show approval queue ───
router.get('/queue', async (_req, res) => {
  try {
    const approved = await loadApproved();
    res.json({ queue: approved });
  } catch (err) {
    logger.error({ err }, 'Failed to load approval queue');
    res.status(500).json({ error: 'Failed to load queue', detail: errMsg(err) });
  }
});

// ─── GET /:date — Batch detail with all concepts ───
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const manifest = await loadManifest(date);
    if (!manifest) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const approved = await loadApproved();
    const approvedNums = new Set(approved.filter(a => a.date === date).map(a => a.concept));

    const concepts = manifest.concepts.map(c => ({
      number: c.concept_number,
      title: c.title,
      concept: c.concept,
      hook: c.hook,
      pillar: c.pillar,
      hasThumbnails: c.thumbnail_paths.length > 0,
      thumbnailCount: c.thumbnail_paths.length,
      approved: approvedNums.has(c.concept_number),
      approvedTier: approved.find(a => a.date === date && a.concept === c.concept_number)?.tier ?? null,
      failed: !c.hook && !c.pillar,
    }));

    res.json({
      date: manifest.batch_date,
      tier: manifest.tier,
      conceptCount: manifest.count,
      concepts,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to load batch detail');
    res.status(500).json({ error: 'Failed to load batch', detail: errMsg(err) });
  }
});

// ─── GET /:date/concept/:num — Concept detail with full script ───
router.get('/:date/concept/:num', async (req, res) => {
  try {
    const { date, num } = req.params;
    const conceptNum = parseInt(num, 10);
    if (isNaN(conceptNum)) {
      return res.status(400).json({ error: 'Invalid concept number' });
    }

    const manifest = await loadManifest(date);
    if (!manifest) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const concept = manifest.concepts.find(c => c.concept_number === conceptNum);
    if (!concept) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    // Load script
    let script = null;
    try {
      const padded = String(conceptNum).padStart(2, '0');
      const scriptPath = path.join(BATCHES_DIR, date, `concept-${padded}`, 'script.json');
      const raw = await fs.readFile(scriptPath, 'utf-8');
      script = JSON.parse(raw);
    } catch {
      // Script may not exist for failed concepts
    }

    // Check approval status
    const approved = await loadApproved();
    const entry = approved.find(a => a.date === date && a.concept === conceptNum);

    // List available images
    let images: string[] = [];
    try {
      const padded = String(conceptNum).padStart(2, '0');
      const imagesDir = path.join(BATCHES_DIR, date, `concept-${padded}`, 'images');
      const files = await fs.readdir(imagesDir);
      images = files.filter(f => f.endsWith('.png')).sort();
    } catch {
      // No images directory
    }

    res.json({
      number: concept.concept_number,
      title: concept.title,
      concept: concept.concept,
      hook: concept.hook,
      pillar: concept.pillar,
      script,
      images,
      approved: !!entry,
      approvedTier: entry?.tier ?? null,
      approvedAt: entry?.approvedAt ?? null,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to load concept detail');
    res.status(500).json({ error: 'Failed to load concept', detail: errMsg(err) });
  }
});

// ─── GET /:date/concept/:num/image/:filename — Serve scene PNG ───
router.get('/:date/concept/:num/image/:filename', async (req, res) => {
  try {
    const { date, num, filename } = req.params;
    const conceptNum = parseInt(num, 10);
    if (isNaN(conceptNum)) {
      return res.status(400).json({ error: 'Invalid concept number' });
    }

    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    if (!safeName.endsWith('.png')) {
      return res.status(400).json({ error: 'Only PNG files supported' });
    }

    const padded = String(conceptNum).padStart(2, '0');
    const imagePath = path.join(BATCHES_DIR, date, `concept-${padded}`, 'images', safeName);

    try {
      await fs.access(imagePath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(imagePath);
  } catch (err) {
    logger.error({ err }, 'Failed to serve image');
    res.status(500).json({ error: 'Failed to serve image', detail: errMsg(err) });
  }
});

// ─── POST /:date/approve — Approve concepts ───
router.post('/:date/approve', async (req, res) => {
  try {
    const { date } = req.params;
    const { concepts: conceptNums, tier = 'draft' } = req.body;

    if (!Array.isArray(conceptNums) || conceptNums.length === 0) {
      return res.status(400).json({ error: 'concepts must be a non-empty array of numbers' });
    }

    const manifest = await loadManifest(date);
    if (!manifest) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const validNums = new Set(manifest.concepts.map(c => c.concept_number));
    const invalid = conceptNums.filter((n: number) => !validNums.has(n));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Invalid concept numbers: ${invalid.join(', ')}` });
    }

    const approved = await loadApproved();
    const now = new Date().toISOString();

    for (const num of conceptNums) {
      const existing = approved.findIndex(a => a.date === date && a.concept === num);
      const concept = manifest.concepts.find(c => c.concept_number === num)!;
      const entry: ApprovedEntry = {
        date,
        concept: num,
        title: concept.title,
        tier,
        approvedAt: now,
      };

      if (existing >= 0) {
        approved[existing] = entry;
      } else {
        approved.push(entry);
      }
    }

    await saveApproved(approved);

    logger.info({ date, concepts: conceptNums, tier }, 'Batch concepts approved');
    res.json({ approved: conceptNums.length, tier, date });
  } catch (err) {
    logger.error({ err }, 'Failed to approve concepts');
    res.status(500).json({ error: 'Failed to approve', detail: errMsg(err) });
  }
});

// ─── PUT /:date/concept/:num/script — Update a concept's script ───
router.put('/:date/concept/:num/script', async (req, res) => {
  try {
    const { date, num } = req.params;
    const conceptNum = parseInt(num, 10);
    if (isNaN(conceptNum)) {
      return res.status(400).json({ error: 'Invalid concept number' });
    }

    const manifest = await loadManifest(date);
    if (!manifest) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const concept = manifest.concepts.find(c => c.concept_number === conceptNum);
    if (!concept) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    const script = req.body;
    if (!script || !script.title || !script.scenes || !Array.isArray(script.scenes) || script.scenes.length === 0) {
      return res.status(400).json({ error: 'Invalid script: must have title and at least one scene' });
    }
    for (const scene of script.scenes) {
      if (typeof scene.scene_number !== 'number' || typeof scene.duration_seconds !== 'number') {
        return res.status(400).json({ error: 'Invalid scene: missing scene_number or duration_seconds' });
      }
    }

    const padded = String(conceptNum).padStart(2, '0');
    const conceptDir = path.join(BATCHES_DIR, date, `concept-${padded}`);
    const scriptPath = path.join(conceptDir, 'script.json');

    await fs.mkdir(conceptDir, { recursive: true });

    // Backup existing script before overwriting
    try {
      await fs.access(scriptPath);
      const backupPath = path.join(conceptDir, `script.${Date.now()}.bak.json`);
      await fs.copyFile(scriptPath, backupPath);
    } catch { /* no existing script to back up */ }

    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

    logger.info({ date, concept: conceptNum }, 'Batch concept script updated');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to update concept script');
    res.status(500).json({ error: 'Failed to update script', detail: errMsg(err) });
  }
});

// ─── POST /:date/reject — Remove concepts from approval queue ───
router.post('/:date/reject', async (req, res) => {
  try {
    const { date } = req.params;
    const { concepts: conceptNums } = req.body;

    if (!Array.isArray(conceptNums) || conceptNums.length === 0) {
      return res.status(400).json({ error: 'concepts must be a non-empty array of numbers' });
    }

    const approved = await loadApproved();
    const rejectSet = new Set(conceptNums as number[]);
    const filtered = approved.filter(a => !(a.date === date && rejectSet.has(a.concept)));
    await saveApproved(filtered);

    logger.info({ date, concepts: conceptNums }, 'Batch concepts rejected');
    res.json({ rejected: conceptNums.length, date });
  } catch (err) {
    logger.error({ err }, 'Failed to reject concepts');
    res.status(500).json({ error: 'Failed to reject', detail: errMsg(err) });
  }
});

export default router;
