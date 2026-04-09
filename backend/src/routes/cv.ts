import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { convertToHtml } from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { parseCvWithOpenAI } from '../lib/cvParser.js';
import { logger } from '../lib/logger.js';

/**
 * Strip personal data from CV-generated bio before saving to DB.
 * This is the BACKEND safety net — even if the frontend doesn't sanitize,
 * personal info never reaches the database.
 */
export function sanitizeBio(bio: string | null | undefined, name: string | null | undefined): string | null {
  if (!bio) return null;
  let clean = bio;
  // Strip the person's full name (case-insensitive)
  if (name) {
    clean = clean.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
  }
  // Strip "FirstName LastName is/was/has/have/been" at the start
  clean = clean.replace(/^[A-Z][a-z]+ [A-Z][a-z]+ (is |was |has |have |been )/i, '').trim();
  // Strip first name only patterns: "FirstName is/was/has..."
  if (name) {
    const firstName = name.split(/\s+/)[0];
    if (firstName) {
      clean = clean.replace(new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(is |was |has |have |been )`, 'i'), '').trim();
    }
  }
  // Strip orphaned "is a/was a/has been" at the very start (left after name removal)
  clean = clean.replace(/^(is |was |has been |has |have been |have )(a |an )?/i, '').trim();
  // Capitalize first letter after cleanup
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  // Strip email addresses
  clean = clean.replace(/[\w.-]+@[\w.-]+\.\w+/g, '').trim();
  // Strip phone numbers
  clean = clean.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '').trim();
  // Clean up double spaces and leading punctuation
  clean = clean.replace(/\s{2,}/g, ' ').replace(/^[,;.\s]+/, '').trim();
  return clean.slice(0, 500) || null;
}
import { uploadToR2, getR2ObjectBuffer } from '../lib/storage.js';

// pdf-parse v2 exports a PDFParse class; v1 exports a callable function.
// Detect which version is installed and provide a unified interface.
let pdfExtractor: ((buf: Buffer) => Promise<{ text: string }>) | null = null;
async function getPdfExtractor() {
  if (!pdfExtractor) {
    const mod = await import('pdf-parse');
    const PDFParse = (mod as any).PDFParse;
    if (PDFParse && typeof PDFParse === 'function' && PDFParse.prototype?.getText) {
      // v2 class API: new PDFParse({ data }) → .getText() → { text }
      pdfExtractor = async (buf: Buffer) => {
        const parser = new PDFParse({ data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) });
        try {
          const result = await parser.getText();
          return { text: result.text };
        } finally {
          await parser.destroy().catch(() => {});
        }
      };
    } else {
      // v1 function API: pdfParse(buffer) → { text }
      const fn = (mod as any).default || mod;
      pdfExtractor = (buf: Buffer) => fn(buf);
    }
  }
  return pdfExtractor;
}

const router = Router();

// ─── In-memory store for CV parse jobs ───
interface CvParseJob {
  status: 'pending' | 'complete' | 'failed';
  data?: any;
  error?: string;
  userId: string;
  fileBuffer?: Buffer;
  fileMimeType?: string;
}

const cvParseJobs = new Map<string, CvParseJob>();

/** Map MIME type to file extension for R2 storage key */
function mimeToExt(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('word') || mime.includes('openxmlformats')) return 'docx';
  return 'bin';
}

/**
 * Persist CV file to R2 and save the key in the user's profile.
 * Returns the R2 key. Non-blocking — errors are logged, not thrown.
 */
async function persistCvToR2(userId: string, fileBuffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeToExt(mimeType);
    const key = `cvs/${userId}/${uuidv4()}.${ext}`;
    await uploadToR2(key, fileBuffer, mimeType);
    await prisma.human.update({
      where: { id: userId },
      data: { cvFileKey: key },
    });
    logger.info({ userId, key, size: fileBuffer.length }, 'CV file persisted to R2');
    return key;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to persist CV to R2 — parsing will continue from memory');
    return null;
  }
}

// Multer: memory storage, 5MB limit for PDFs and DOCX
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

// Rate limit: 10 CV uploads per day per user
const uploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.userId || 'unknown',
  message: { error: 'Too many CV uploads. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const extract = await getPdfExtractor();
    const data = await extract(buffer);
    return data.text;
  } catch (error) {
    logger.error({ err: error }, 'PDF extraction error');
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to ArrayBuffer
    const arrayBuffer: ArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const result = await convertToHtml({ arrayBuffer });
    // Simple HTML to text conversion: remove tags and decode entities
    return result.value
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  } catch (error) {
    logger.error({ err: error }, 'DOCX extraction error');
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Background CV parsing function (fire-and-forget)
 * Extracts text, parses with OpenAI, and saves to database
 */
async function parseAndSaveCv(fileId: string, job: CvParseJob): Promise<void> {
  try {
    if (!job.fileBuffer || !job.fileMimeType) {
      throw new Error('Missing file buffer or MIME type');
    }

    // Get current user's data
    const user = await prisma.human.findUnique({
      where: { id: job.userId },
      select: { skills: true, languages: true, bio: true },
    });

    if (!user) {
      job.status = 'failed';
      job.error = 'User not found';
      return;
    }

    // Extract text based on file type
    let cvText: string;
    if (job.fileMimeType === 'application/pdf') {
      cvText = await extractTextFromPdf(job.fileBuffer);
    } else {
      // DOCX or DOC
      cvText = await extractTextFromDocx(job.fileBuffer);
    }

    if (!cvText || cvText.trim().length < 100) {
      job.status = 'failed';
      job.error = 'CV file appears to be empty or too short';
      return;
    }

    // Parse CV with OpenAI
    const parseResult = await parseCvWithOpenAI(cvText, user.skills);

    // Merge new skills with existing
    const mergedSkills = Array.from(
      new Set([...user.skills, ...parseResult.skills, ...parseResult.inferredSkills])
    );

    // Build skillSources map
    const skillSources: Record<string, string> = {};
    for (const skill of parseResult.skills) {
      skillSources[skill] = 'cv';
    }
    for (const skill of parseResult.inferredSkills) {
      skillSources[skill] = 'cv_inferred';
    }

    // Create education entries
    const educationEntries = parseResult.education.map(edu => ({
      humanId: job.userId,
      institution: edu.institution,
      country: edu.country || null,
      degree: edu.degree || null,
      field: edu.field || null,
      startYear: edu.startYear || null,
      endYear: edu.endYear || null,
      year: edu.endYear || edu.startYear || null, // Legacy sync
      source: 'cv' as const,
    }));

    // Create certificate entries
    const certificateEntries = parseResult.certificates.map(cert => ({
      humanId: job.userId,
      name: cert.name,
      issuer: cert.issuer || null,
      year: cert.year || null,
      source: 'cv' as const,
    }));

    // Update human profile in a transaction
    const updated = await prisma.$transaction(async tx => {
      // Delete existing CV-sourced education and certificates to avoid duplicates
      await (tx as any).education.deleteMany({
        where: { humanId: job.userId, source: 'cv' },
      });
      await (tx as any).certificate.deleteMany({
        where: { humanId: job.userId, source: 'cv' },
      });

      // Create new education entries
      if (educationEntries.length > 0) {
        await (tx as any).education.createMany({
          data: educationEntries,
        });
      }

      // Create new certificate entries
      if (certificateEntries.length > 0) {
        await (tx as any).certificate.createMany({
          data: certificateEntries,
        });
      }

      // Update human with parsed data
      return tx.human.update({
        where: { id: job.userId },
        data: {
          skills: mergedSkills,
          languages: Array.from(new Set([...user.languages || [], ...parseResult.languages])),
          bio: sanitizeBio(parseResult.bio, parseResult.name) || user.bio || null,
          experienceHighlights: parseResult.experienceHighlights,
          yearsOfExperience: parseResult.yearsOfExperience,
          cvParsedAt: new Date(),
          cvConsent: true,
          skillSources: skillSources,
        } as any,
        include: {
          educations: { where: { source: 'cv' } },
          certificates: { where: { source: 'cv' } },
        } as any,
      });
    });

    // Store result in job
    job.status = 'complete';
    job.data = {
      message: 'CV parsed successfully',
      name: parseResult.name,
      skills: {
        explicit: parseResult.skills,
        inferred: parseResult.inferredSkills,
      },
      education: (updated as any).educations,
      certificates: (updated as any).certificates,
      bio: (updated as any).bio,
      languages: (updated as any).languages,
      yearsOfExperience: (updated as any).yearsOfExperience,
      experienceHighlights: (updated as any).experienceHighlights,
      cvParsedAt: (updated as any).cvParsedAt,
    };

    // Clean up file buffer to save memory
    job.fileBuffer = undefined;
  } catch (error) {
    logger.error({ err: error, fileId }, 'Background CV parse error');
    job.status = 'failed';
    if (error instanceof Error) {
      job.error = error.message;
    } else {
      job.error = 'Failed to process CV';
    }
    // Clean up file buffer
    job.fileBuffer = undefined;
  }
}

/**
 * POST /upload — Upload and parse CV (PDF or DOCX)
 */
router.post(
  '/upload',
  authenticateToken,
  uploadLimiter,
  upload.single('cv'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CV file provided' });
      }

      // Persist CV file to R2 immediately (fire-and-forget, don't block parsing)
      persistCvToR2(req.userId!, req.file.buffer, req.file.mimetype).catch(err => {
        logger.error({ err }, 'Background R2 persist failed (sync upload)');
      });

      // Get current user's data
      const user = await prisma.human.findUnique({
        where: { id: req.userId },
        select: { skills: true, languages: true, bio: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Extract text based on file type
      let cvText: string;
      if (req.file.mimetype === 'application/pdf') {
        cvText = await extractTextFromPdf(req.file.buffer);
      } else {
        // DOCX or DOC
        cvText = await extractTextFromDocx(req.file.buffer);
      }

      if (!cvText || cvText.trim().length < 100) {
        return res
          .status(400)
          .json({ error: 'CV file appears to be empty or too short' });
      }

      // Parse CV with OpenAI
      const parseResult = await parseCvWithOpenAI(cvText, user.skills);

      // Merge new skills with existing
      const mergedSkills = Array.from(
        new Set([...user.skills, ...parseResult.skills, ...parseResult.inferredSkills])
      );

      // Build skillSources map
      const skillSources: Record<string, string> = {};
      for (const skill of parseResult.skills) {
        skillSources[skill] = 'cv';
      }
      for (const skill of parseResult.inferredSkills) {
        skillSources[skill] = 'cv_inferred';
      }

      // Create education entries
      const educationEntries = parseResult.education.map(edu => ({
        humanId: req.userId!,
        institution: edu.institution,
        country: edu.country || null,
        degree: edu.degree || null,
        field: edu.field || null,
        startYear: edu.startYear || null,
        endYear: edu.endYear || null,
        year: edu.endYear || edu.startYear || null,
        source: 'cv' as const,
      }));

      // Create certificate entries
      const certificateEntries = parseResult.certificates.map(cert => ({
        humanId: req.userId!,
        name: cert.name,
        issuer: cert.issuer || null,
        year: cert.year || null,
        source: 'cv' as const,
      }));

      // Update human profile in a transaction
      const updated = await prisma.$transaction(async tx => {
        // Delete existing CV-sourced education and certificates to avoid duplicates
        await (tx as any).education.deleteMany({
          where: { humanId: req.userId, source: 'cv' },
        });
        await (tx as any).certificate.deleteMany({
          where: { humanId: req.userId, source: 'cv' },
        });

        // Create new education entries
        if (educationEntries.length > 0) {
          await (tx as any).education.createMany({
            data: educationEntries,
          });
        }

        // Create new certificate entries
        if (certificateEntries.length > 0) {
          await (tx as any).certificate.createMany({
            data: certificateEntries,
          });
        }

        // Update human with parsed data
        return tx.human.update({
          where: { id: req.userId },
          data: {
            skills: mergedSkills,
            languages: Array.from(new Set([...user.languages || [], ...parseResult.languages])),
            bio: sanitizeBio(parseResult.bio, parseResult.name) || user.bio || null,
            experienceHighlights: parseResult.experienceHighlights,
            yearsOfExperience: parseResult.yearsOfExperience,
            cvParsedAt: new Date(),
            cvConsent: true,
            skillSources: skillSources,
          } as any,
          include: {
            educations: { where: { source: 'cv' } },
            certificates: { where: { source: 'cv' } },
          } as any,
        });
      });

      res.json({
        message: 'CV parsed successfully',
        name: parseResult.name,
        skills: {
          explicit: parseResult.skills,
          inferred: parseResult.inferredSkills,
        },
        education: (updated as any).educations,
        certificates: (updated as any).certificates,
        bio: (updated as any).bio,
        languages: (updated as any).languages,
        yearsOfExperience: (updated as any).yearsOfExperience,
        experienceHighlights: (updated as any).experienceHighlights,
        cvParsedAt: (updated as any).cvParsedAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('PDF') || error.message.includes('DOCX')) {
          logger.warn({ err: error }, 'File extraction error');
          return res.status(400).json({ error: error.message });
        }
        if (error.message.includes('OPENAI_API_KEY not configured')) {
          logger.error('CV upload failed: OPENAI_API_KEY not configured');
          return res.status(503).json({ error: 'CV analysis is temporarily unavailable. Please try again later.' });
        }
        // OpenAI API errors (rate limit, auth, etc.)
        if (error.message.includes('401') || error.message.includes('429') || error.message.includes('OpenAI')) {
          logger.error({ err: error }, 'CV upload failed: OpenAI API error');
          return res.status(503).json({ error: 'CV analysis service is temporarily unavailable. Please try again later.' });
        }
        logger.error({ err: error }, 'CV upload/parse error');
      }
      res.status(500).json({ error: 'Failed to process CV' });
    }
  }
);

/**
 * POST /upload-file — Async CV upload stage 1
 * Accepts file upload and starts background parsing
 */
router.post(
  '/upload-file',
  authenticateToken,
  uploadLimiter,
  upload.single('cv'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CV file provided' });
      }

      // Generate a unique fileId
      const fileId = uuidv4();

      // Persist CV file to R2 immediately (before parsing starts)
      // This ensures the file survives server restarts and can be re-parsed later
      persistCvToR2(req.userId!, req.file.buffer, req.file.mimetype).catch(err => {
        logger.error({ err, fileId }, 'Background R2 persist failed');
      });

      // Create job entry with pending status
      const job: CvParseJob = {
        status: 'pending',
        userId: req.userId!,
        fileBuffer: req.file.buffer,
        fileMimeType: req.file.mimetype,
      };

      cvParseJobs.set(fileId, job);

      // Fire-and-forget background parse (don't await)
      parseAndSaveCv(fileId, job).catch(err => {
        logger.error({ err, fileId }, 'Unhandled error in background CV parse');
      });

      // Return immediately with fileId
      res.json({ fileId });
    } catch (error) {
      logger.error({ err: error }, 'CV upload-file error');
      res.status(500).json({ error: 'Failed to upload CV file' });
    }
  }
);

/**
 * GET /parse-status/:fileId — Async CV upload stage 2
 * Returns the current parse status and data when ready
 */
router.get('/parse-status/:fileId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const job = cvParseJobs.get(fileId);

    if (!job) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Verify ownership (user who uploaded the file)
    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Return current status
    if (job.status === 'complete') {
      return res.json({
        status: 'complete',
        data: job.data,
      });
    }

    if (job.status === 'failed') {
      return res.json({
        status: 'failed',
        error: job.error || 'Failed to parse CV',
      });
    }

    // Still pending
    res.json({ status: 'pending' });
  } catch (error) {
    logger.error({ err: error }, 'CV parse-status error');
    res.status(500).json({ error: 'Failed to check parse status' });
  }
});

/**
 * POST /education — Add manual education entry
 */
const educationSchema = z.object({
  institution: z.string().min(1),
  country: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  field: z.string().optional().nullable(),
  startYear: z.number().int().min(1900).max(2100).optional().nullable(),
  endYear: z.number().int().min(1900).max(2100).optional().nullable(),
});

router.post('/education', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = educationSchema.parse(req.body);

    const education = await (prisma as any).education.create({
      data: {
        ...data,
        year: data.endYear || data.startYear || null, // Legacy field — kept in sync
        humanId: req.userId!,
        source: 'manual',
      },
    });

    res.status(201).json(education);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create education error');
    res.status(500).json({ error: 'Failed to create education entry' });
  }
});

/**
 * DELETE /education/:id — Delete education entry (verify ownership)
 */
router.delete('/education/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const education = await (prisma as any).education.findUnique({
      where: { id: req.params.id },
      select: { humanId: true },
    });

    if (!education) {
      return res.status(404).json({ error: 'Education entry not found' });
    }

    if (education.humanId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await (prisma as any).education.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Education entry deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete education error');
    res.status(500).json({ error: 'Failed to delete education entry' });
  }
});

/**
 * POST /certificate — Add manual certificate entry
 */
const certificateSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
});

router.post('/certificate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = certificateSchema.parse(req.body);

    const certificate = await (prisma as any).certificate.create({
      data: {
        ...data,
        humanId: req.userId!,
        source: 'manual',
      },
    });

    res.status(201).json(certificate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create certificate error');
    res.status(500).json({ error: 'Failed to create certificate entry' });
  }
});

/**
 * DELETE /certificate/:id — Delete certificate entry (verify ownership)
 */
router.delete('/certificate/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const certificate = await (prisma as any).certificate.findUnique({
      where: { id: req.params.id },
      select: { humanId: true },
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    if (certificate.humanId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await (prisma as any).certificate.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Certificate deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete certificate error');
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

/**
 * POST /reparse — Re-parse the user's stored CV file from R2
 * Useful when parsing failed previously, or when the AI parser improves
 */
router.post('/reparse', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { cvFileKey: true },
    });

    if (!human?.cvFileKey) {
      return res.status(404).json({ error: 'No CV file found. Please upload a new one.' });
    }

    // Determine MIME type from stored key
    const ext = human.cvFileKey.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Download from R2
    const fileBuffer = await getR2ObjectBuffer(human.cvFileKey);
    if (!fileBuffer) {
      logger.warn({ key: human.cvFileKey }, 'CV file not found in R2 for reparse');
      return res.status(404).json({ error: 'CV file no longer available in storage. Please upload a new one.' });
    }

    // Create a parse job and run it
    const fileId = uuidv4();
    const job: CvParseJob = {
      status: 'pending',
      userId: req.userId!,
      fileBuffer,
      fileMimeType: mimeType,
    };

    cvParseJobs.set(fileId, job);

    // Fire-and-forget background parse
    parseAndSaveCv(fileId, job).catch(err => {
      logger.error({ err, fileId }, 'Unhandled error in reparse');
    });

    res.json({ fileId, message: 'Re-parsing started. Poll /parse-status/:fileId for results.' });
  } catch (error) {
    logger.error({ err: error }, 'CV reparse error');
    res.status(500).json({ error: 'Failed to start re-parse' });
  }
});

// Handle multer errors (file too large, wrong type, etc.)
// Without this, multer errors crash the request and the browser gets no JSON response,
// which triggers the generic "Failed to fetch" / "can't fetch" error in the frontend.
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.includes('Only PDF') || err?.message?.includes('DOCX')) {
    return res.status(400).json({ error: 'Only PDF and DOCX files are allowed' });
  }
  next(err);
});

export default router;
