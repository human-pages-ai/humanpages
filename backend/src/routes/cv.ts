import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { convertToHtml } from 'mammoth';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { parseCvWithOpenAI } from '../lib/cvParser.js';
import { logger } from '../lib/logger.js';

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
        year: edu.year || null,
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
            bio: parseResult.bio || user.bio || null,
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
 * POST /education — Add manual education entry
 */
const educationSchema = z.object({
  institution: z.string().min(1),
  country: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  field: z.string().optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
});

router.post('/education', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = educationSchema.parse(req.body);

    const education = await (prisma as any).education.create({
      data: {
        ...data,
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
