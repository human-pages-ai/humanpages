import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireConcierge } from '../middleware/requireConcierge.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { generateReferralCode } from '../lib/referralCode.js';
import { sendEmailWithOutbox } from '../lib/email.js';
import { moderateText } from '../lib/moderation.js';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ===== TOKEN GENERATION =====

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // No ambiguous chars (0/O, 1/l/I)
const TOKEN_LENGTH = 12;

function generateMagicToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return token;
}

// ===== RATE LIMITERS =====

const conciergeRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req: AuthRequest) => req.userId || req.ip || 'unknown',
  message: { error: 'Too many postings created today. Try again tomorrow.' },
});

const publicApplyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Too many applications. Please try again later.' },
});

// ===== VALIDATION SCHEMAS =====

const createPostingSchema = z.object({
  jobId: z.string().min(1),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(3000),
  externalNote: z.string().max(1000).optional(),
  suggestedSkills: z.array(z.string()).max(20).optional(),
  suggestedLocation: z.string().max(200).optional(),
  suggestedEquipment: z.array(z.string()).max(10).optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

const updatePostingSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).max(3000).optional(),
  externalNote: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  suggestedSkills: z.array(z.string()).max(20).optional(),
  suggestedLocation: z.string().max(200).optional(),
  suggestedEquipment: z.array(z.string()).max(10).optional(),
});

const externalApplySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().max(30).optional(),
  pitch: z.string().min(10).max(1000),
  portfolioUrl: z.string().url().max(500).optional(),
  website: z.string().max(500).optional(), // Honeypot field
});

const updateApplicationSchema = z.object({
  status: z.enum(['REVIEWED', 'SHORTLISTED', 'REJECTED']),
  reviewNote: z.string().max(500).optional(),
});

const hireSchema = z.object({
  priceUsdc: z.number().positive().max(1000000),
  paymentTiming: z.enum(['upfront', 'upon_completion']).optional().default('upfront'),
  customDescription: z.string().max(5000).optional(),
});

// ============================
// CONCIERGE-ONLY ENDPOINTS
// ============================

// POST / — Create a new external posting from a job
router.post('/', conciergeRateLimiter, authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const data = createPostingSchema.parse(req.body);

    // Verify the job belongs to this concierge
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      select: {
        id: true,
        humanId: true,
        agentId: true,
        title: true,
        description: true,
        status: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.humanId !== req.userId) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'You can only create postings for jobs assigned to you.',
      });
    }

    // Job must be in ACCEPTED or PAID status
    if (!['ACCEPTED', 'PAID'].includes(job.status)) {
      return res.status(400).json({
        error: 'Invalid job status',
        message: `Cannot create a posting for a job with status: ${job.status}. Job must be ACCEPTED or PAID.`,
      });
    }

    // Check if there's already an active posting for this job
    const existingPosting = await prisma.conciergePosting.findFirst({
      where: {
        jobId: data.jobId,
        status: { in: ['DRAFT', 'ACTIVE'] },
      },
    });

    if (existingPosting) {
      return res.status(409).json({
        error: 'Posting already exists',
        message: 'There is already an active or draft posting for this job.',
        existingPostingId: existingPosting.id,
      });
    }

    // Moderate text content
    const titleMod = await moderateText(data.title);
    const descMod = await moderateText(data.description);
    if (titleMod?.flagged || descMod?.flagged) {
      return res.status(400).json({
        error: 'Content flagged',
        message: 'The title or description was flagged by our content moderation system. Please revise.',
      });
    }

    // Generate unique magic token (retry on collision)
    let magicToken: string;
    let attempts = 0;
    do {
      magicToken = generateMagicToken();
      const existing = await prisma.conciergePosting.findUnique({ where: { magicToken } });
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) {
      return res.status(500).json({ error: 'Failed to generate unique token. Please try again.' });
    }

    const posting = await prisma.conciergePosting.create({
      data: {
        jobId: data.jobId,
        conciergeId: req.userId!,
        title: data.title,
        description: data.description,
        externalNote: data.externalNote,
        suggestedSkills: data.suggestedSkills || [],
        suggestedLocation: data.suggestedLocation,
        suggestedEquipment: data.suggestedEquipment || [],
        magicToken,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
        status: 'DRAFT',
      },
    });

    trackServerEvent(req.userId!, 'concierge_posting_created', {
      postingId: posting.id,
      jobId: data.jobId,
    }, req);

    res.status(201).json({
      id: posting.id,
      magicToken: posting.magicToken,
      magicUrl: `${FRONTEND_URL}/apply/${posting.magicToken}`,
      status: posting.status,
      message: 'Posting created as DRAFT. Set status to ACTIVE when ready to share the link.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create concierge posting error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — List all postings for the authenticated concierge
router.get('/', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    const where: any = { conciergeId: req.userId };
    if (status && ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status as string)) {
      where.status = status as string;
    }

    const [postings, total] = await Promise.all([
      prisma.conciergePosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit as string, 10) || 20, 50),
        skip: parseInt(offset as string, 10) || 0,
        include: {
          job: {
            select: { id: true, title: true, status: true, agentName: true },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.conciergePosting.count({ where }),
    ]);

    res.json({
      postings: postings.map(p => ({
        ...p,
        magicUrl: `${FRONTEND_URL}/apply/${p.magicToken}`,
        applicationCount: p._count.applications,
        _count: undefined,
      })),
      total,
    });
  } catch (error) {
    logger.error({ err: error }, 'List concierge postings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — Get a specific posting with details
router.get('/:id', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          select: { id: true, title: true, description: true, status: true, agentId: true, agentName: true, priceUsdc: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!posting) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    if (posting.conciergeId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      ...posting,
      magicUrl: `${FRONTEND_URL}/apply/${posting.magicToken}`,
      applicationCount: posting._count.applications,
      _count: undefined,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get concierge posting error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id — Update a posting
router.patch('/:id', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const data = updatePostingSchema.parse(req.body);

    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
    });

    if (!posting) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    if (posting.conciergeId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Can't reopen an archived posting
    if (posting.status === 'ARCHIVED' && data.status !== 'ARCHIVED') {
      return res.status(400).json({
        error: 'Cannot reopen archived posting',
        message: 'Archived postings cannot be reactivated. Create a new posting instead.',
      });
    }

    // Moderate text if changed
    if (data.title) {
      const mod = await moderateText(data.title);
      if (mod?.flagged) {
        return res.status(400).json({ error: 'Title flagged by content moderation. Please revise.' });
      }
    }
    if (data.description) {
      const mod = await moderateText(data.description);
      if (mod?.flagged) {
        return res.status(400).json({ error: 'Description flagged by content moderation. Please revise.' });
      }
    }

    const updateData: any = { ...data };
    if (data.status === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.conciergePosting.update({
      where: { id: req.params.id },
      data: updateData,
    });

    trackServerEvent(req.userId!, 'concierge_posting_updated', {
      postingId: updated.id,
      status: updated.status,
    }, req);

    res.json({
      ...updated,
      magicUrl: `${FRONTEND_URL}/apply/${updated.magicToken}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update concierge posting error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================
// APPLICATION MANAGEMENT
// ============================

// GET /:id/applications — List applications for a posting
router.get('/:id/applications', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const { status, limit = '20', offset = '0', sortBy = 'newest' } = req.query;

    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
      select: { conciergeId: true },
    });

    if (!posting) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    if (posting.conciergeId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const where: any = { postingId: req.params.id };
    if (status && ['NEW', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED'].includes(status as string)) {
      where.status = status as string;
    }

    const orderBy = sortBy === 'status'
      ? [{ status: 'asc' as const }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }];

    const [applications, total] = await Promise.all([
      prisma.externalApplication.findMany({
        where,
        orderBy,
        take: Math.min(parseInt(limit as string, 10) || 20, 50),
        skip: parseInt(offset as string, 10) || 0,
        include: {
          linkedHuman: {
            select: { id: true, name: true, username: true, profilePhotoKey: true },
          },
          subJob: {
            select: { id: true, status: true, priceUsdc: true },
          },
        },
      }),
      prisma.externalApplication.count({ where }),
    ]);

    res.json({ applications, total });
  } catch (error) {
    logger.error({ err: error }, 'List applications error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/applications/:appId — Get a single application
router.get('/:id/applications/:appId', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
      select: { conciergeId: true },
    });

    if (!posting || posting.conciergeId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const application = await prisma.externalApplication.findUnique({
      where: { id: req.params.appId },
      include: {
        linkedHuman: {
          select: { id: true, name: true, username: true, email: true, profilePhotoKey: true, skills: true, location: true },
        },
        subJob: {
          select: { id: true, status: true, priceUsdc: true, title: true },
        },
      },
    });

    if (!application || application.postingId !== req.params.id) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    logger.error({ err: error }, 'Get application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/applications/:appId — Update application status
router.patch('/:id/applications/:appId', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateApplicationSchema.parse(req.body);

    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
      select: { conciergeId: true, title: true },
    });

    if (!posting || posting.conciergeId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const application = await prisma.externalApplication.findUnique({
      where: { id: req.params.appId },
    });

    if (!application || application.postingId !== req.params.id) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status === 'HIRED') {
      return res.status(400).json({
        error: 'Cannot update hired application',
        message: 'This applicant has already been hired.',
      });
    }

    const updated = await prisma.externalApplication.update({
      where: { id: req.params.appId },
      data: {
        status: data.status,
        reviewNote: data.reviewNote ?? application.reviewNote,
        reviewedAt: new Date(),
      },
    });

    // Send email notifications based on status change
    if (data.status === 'SHORTLISTED') {
      sendExternalApplicationEmail(application.email, application.name, posting.title, 'shortlisted').catch(err =>
        logger.error({ err }, 'Failed to send shortlist email')
      );
    } else if (data.status === 'REJECTED') {
      sendExternalApplicationEmail(application.email, application.name, posting.title, 'rejected').catch(err =>
        logger.error({ err }, 'Failed to send rejection email')
      );
    }

    trackServerEvent(req.userId!, 'concierge_application_updated', {
      applicationId: updated.id,
      status: data.status,
    }, req);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/applications/:appId/hire — Hire applicant: auto-create account + sub-job
router.post('/:id/applications/:appId/hire', authenticateToken, requireConcierge, async (req: AuthRequest, res: Response) => {
  try {
    const data = hireSchema.parse(req.body);

    // Verify posting ownership
    const posting = await prisma.conciergePosting.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          select: { id: true, agentId: true, agentName: true, registeredAgentId: true, title: true, description: true, callbackUrl: true, callbackSecret: true },
        },
      },
    });

    if (!posting || posting.conciergeId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Verify application
    const application = await prisma.externalApplication.findUnique({
      where: { id: req.params.appId },
    });

    if (!application || application.postingId !== req.params.id) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status === 'HIRED') {
      return res.status(400).json({
        error: 'Already hired',
        message: 'This applicant has already been hired.',
      });
    }

    if (application.subJobId) {
      return res.status(400).json({
        error: 'Sub-job already exists',
        message: 'A sub-job has already been created for this application.',
      });
    }

    // Check if applicant already has an account (by email)
    let humanId: string;
    let isNewAccount = false;

    const existingHuman = await prisma.human.findUnique({
      where: { email: application.email },
      select: { id: true, name: true, email: true },
    });

    if (existingHuman) {
      humanId = existingHuman.id;
    } else {
      // Auto-create account with pre-filled profile from posting context
      const tempPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const newHuman = await prisma.human.create({
        data: {
          email: application.email,
          passwordHash,
          name: application.name,
          contactEmail: application.email,
          skills: posting.suggestedSkills || [],
          location: posting.suggestedLocation || undefined,
          equipment: posting.suggestedEquipment || [],
          referralCode: generateReferralCode(),
          referredBy: req.userId!, // Concierge is the referrer
          utmSource: 'concierge_posting',
          utmMedium: 'magic_link',
          utmCampaign: posting.id,
          emailVerified: false,
          termsAcceptedAt: new Date(),
        },
        select: { id: true },
      });

      humanId = newHuman.id;
      isNewAccount = true;

      trackServerEvent(humanId, 'user_signed_up_server', {
        method: 'concierge_auto_create',
        postingId: posting.id,
      }, req);
    }

    // Create sub-job
    const subJob = await prisma.job.create({
      data: {
        humanId,
        agentId: posting.job.agentId,
        agentName: posting.job.agentName,
        registeredAgentId: posting.job.registeredAgentId,
        title: data.customDescription ? posting.title : posting.job.title,
        description: data.customDescription || posting.description,
        priceUsdc: data.priceUsdc,
        paymentMode: 'ONE_TIME',
        paymentTiming: data.paymentTiming,
        parentJobId: posting.jobId, // Chain to parent job
        callbackUrl: posting.job.callbackUrl,
        callbackSecret: posting.job.callbackSecret,
        status: 'PENDING',
      },
    });

    // Update application
    await prisma.externalApplication.update({
      where: { id: application.id },
      data: {
        status: 'HIRED',
        linkedHumanId: humanId,
        subJobId: subJob.id,
        reviewedAt: new Date(),
      },
    });

    // Send hire email
    if (isNewAccount) {
      // New account: send welcome + password reset email
      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.human.update({
        where: { id: humanId },
        data: { emailVerificationToken: resetToken },
      });

      const setPasswordUrl = `${FRONTEND_URL}/set-password?token=${resetToken}&email=${encodeURIComponent(application.email)}`;

      sendEmailWithOutbox({
        to: application.email,
        subject: `You've been selected for: ${posting.title}`,
        text: `Hi ${application.name},\n\nGreat news! You've been selected for the task "${posting.title}".\n\nTo get started, please set your password and complete your profile:\n${setPasswordUrl}\n\nOnce you're set up, you'll be able to view the job details and accept the offer.\n\nBest regards,\nThe Humans Team`,
        html: `
          <h2>You've been selected!</h2>
          <p>Hi ${application.name},</p>
          <p>Great news! You've been selected for the task <strong>"${posting.title}"</strong>.</p>
          <p>To get started, please set your password and complete your profile:</p>
          <p><a href="${setPasswordUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Set Your Password</a></p>
          <p>Once you're set up, you'll be able to view the job details and accept the offer.</p>
          <p>Best regards,<br>The Humans Team</p>
        `,
      }).catch(err => logger.error({ err }, 'Failed to send hire welcome email'));
    } else {
      // Existing account: send job offer notification
      const jobDetailUrl = `${FRONTEND_URL}/jobs/${subJob.id}`;

      sendEmailWithOutbox({
        to: application.email,
        subject: `New job offer: ${posting.title}`,
        text: `Hi ${application.name},\n\nYou've been selected for the task "${posting.title}" based on your application.\n\nView the job details and accept the offer: ${jobDetailUrl}\n\nBest regards,\nThe Humans Team`,
        html: `
          <h2>New job offer!</h2>
          <p>Hi ${application.name},</p>
          <p>You've been selected for the task <strong>"${posting.title}"</strong> based on your application.</p>
          <p><a href="${jobDetailUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View Job Details</a></p>
          <p>Best regards,<br>The Humans Team</p>
        `,
      }).catch(err => logger.error({ err }, 'Failed to send hire notification email'));
    }

    trackServerEvent(req.userId!, 'concierge_applicant_hired', {
      postingId: posting.id,
      applicationId: application.id,
      subJobId: subJob.id,
      isNewAccount,
    }, req);

    res.status(201).json({
      subJobId: subJob.id,
      humanId,
      isNewAccount,
      message: isNewAccount
        ? 'Applicant hired. A new account has been created and they will receive an email to set their password.'
        : 'Applicant hired. They will receive a job offer notification.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Hire applicant error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================
// PUBLIC ENDPOINTS (No Auth)
// ============================

// GET /public/:magicToken — View posting details
router.get('/public/:magicToken', async (req, res) => {
  try {
    const posting = await prisma.conciergePosting.findUnique({
      where: { magicToken: req.params.magicToken },
      select: {
        id: true,
        title: true,
        description: true,
        suggestedSkills: true,
        suggestedLocation: true,
        suggestedEquipment: true,
        status: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
    });

    if (!posting) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    // Check if posting is active
    if (posting.status !== 'ACTIVE') {
      return res.status(410).json({
        error: 'Posting not available',
        message: posting.status === 'CLOSED'
          ? 'This posting has been closed and is no longer accepting applications.'
          : 'This posting is not currently accepting applications.',
        status: posting.status,
      });
    }

    // Check token expiry
    if (posting.tokenExpiresAt && posting.tokenExpiresAt < new Date()) {
      return res.status(410).json({
        error: 'Posting expired',
        message: 'This posting has expired and is no longer accepting applications.',
      });
    }

    res.json({
      id: posting.id,
      title: posting.title,
      description: posting.description,
      suggestedSkills: posting.suggestedSkills,
      suggestedLocation: posting.suggestedLocation,
      suggestedEquipment: posting.suggestedEquipment,
      createdAt: posting.createdAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get public posting error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /public/:magicToken/apply — Submit an external application
router.post('/public/:magicToken/apply', publicApplyRateLimiter, async (req, res) => {
  try {
    const data = externalApplySchema.parse(req.body);

    // Honeypot check: if the hidden "website" field is filled, it's a bot
    if (data.website) {
      // Silently accept to not tip off the bot
      return res.status(201).json({
        message: 'Application submitted successfully!',
        applicationId: 'ok',
      });
    }

    const posting = await prisma.conciergePosting.findUnique({
      where: { magicToken: req.params.magicToken },
      select: {
        id: true,
        status: true,
        tokenExpiresAt: true,
        conciergeId: true,
        title: true,
      },
    });

    if (!posting) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    if (posting.status !== 'ACTIVE') {
      return res.status(410).json({
        error: 'Posting not available',
        message: 'This posting is no longer accepting applications.',
      });
    }

    if (posting.tokenExpiresAt && posting.tokenExpiresAt < new Date()) {
      return res.status(410).json({
        error: 'Posting expired',
        message: 'This posting has expired.',
      });
    }

    // Check for duplicate application
    const existing = await prisma.externalApplication.findUnique({
      where: {
        postingId_email: {
          postingId: posting.id,
          email: data.email,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Already applied',
        message: 'An application with this email address has already been submitted for this posting.',
      });
    }

    // Moderate pitch content
    const pitchMod = await moderateText(data.pitch);
    if (pitchMod?.flagged) {
      return res.status(400).json({
        error: 'Content flagged',
        message: 'Your application was flagged by our content moderation system. Please revise your pitch.',
      });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgentStr = req.headers['user-agent'] as string;

    const application = await prisma.externalApplication.create({
      data: {
        postingId: posting.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        pitch: data.pitch,
        portfolioUrl: data.portfolioUrl,
        status: 'NEW',
        ipAddress: clientIp,
        userAgent: userAgentStr?.substring(0, 500),
      },
    });

    // Send confirmation email to applicant
    sendEmailWithOutbox({
      to: data.email,
      subject: `Application received: ${posting.title}`,
      text: `Hi ${data.name},\n\nThanks for your application to "${posting.title}"! We've received it and will review it shortly.\n\nWe'll reach out if we'd like to move forward.\n\nBest regards,\nThe Humans Team`,
      html: `
        <h2>Application received!</h2>
        <p>Hi ${data.name},</p>
        <p>Thanks for your application to <strong>"${posting.title}"</strong>! We've received it and will review it shortly.</p>
        <p>We'll reach out if we'd like to move forward.</p>
        <p>Best regards,<br>The Humans Team</p>
      `,
    }).catch(err => logger.error({ err }, 'Failed to send application confirmation email'));

    // Notify concierge
    const concierge = await prisma.human.findUnique({
      where: { id: posting.conciergeId },
      select: { email: true, name: true, emailNotifications: true },
    });

    if (concierge?.emailNotifications) {
      sendEmailWithOutbox({
        to: concierge.email,
        subject: `New application for: ${posting.title}`,
        text: `Hi ${concierge.name},\n\nYou have a new application for "${posting.title}" from ${data.name} (${data.email}).\n\nPitch: ${data.pitch}\n\nView applications in your dashboard: ${FRONTEND_URL}/dashboard?tab=concierge\n\nBest regards,\nThe Humans Team`,
        html: `
          <h2>New application received</h2>
          <p>Hi ${concierge.name},</p>
          <p>You have a new application for <strong>"${posting.title}"</strong>:</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name:</td><td>${data.name}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email:</td><td>${data.email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Pitch:</td><td>${data.pitch.substring(0, 200)}${data.pitch.length > 200 ? '...' : ''}</td></tr>
            ${data.portfolioUrl ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Portfolio:</td><td><a href="${data.portfolioUrl}">${data.portfolioUrl}</a></td></tr>` : ''}
          </table>
          <p><a href="${FRONTEND_URL}/dashboard?tab=concierge" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View in Dashboard</a></p>
        `,
      }).catch(err => logger.error({ err }, 'Failed to send concierge notification email'));
    }

    trackServerEvent(posting.id, 'external_application_submitted', {
      postingId: posting.id,
      applicantEmail: data.email,
    }, req);

    res.status(201).json({
      message: 'Application submitted successfully! We\'ll review it and get back to you soon.',
      applicationId: application.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'External application submission error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================
// EMAIL HELPERS
// ============================

async function sendExternalApplicationEmail(
  email: string,
  name: string,
  postingTitle: string,
  type: 'shortlisted' | 'rejected',
): Promise<void> {
  const subjects: Record<string, string> = {
    shortlisted: `Good news about your application: ${postingTitle}`,
    rejected: `Update on your application: ${postingTitle}`,
  };

  const messages: Record<string, { text: string; html: string }> = {
    shortlisted: {
      text: `Hi ${name},\n\nGreat news! We've reviewed your application for "${postingTitle}" and we'd like to move forward with you.\n\nWe'll be in touch soon with more details.\n\nBest regards,\nThe Humans Team`,
      html: `
        <h2>You've been shortlisted!</h2>
        <p>Hi ${name},</p>
        <p>Great news! We've reviewed your application for <strong>"${postingTitle}"</strong> and we'd like to move forward with you.</p>
        <p>We'll be in touch soon with more details.</p>
        <p>Best regards,<br>The Humans Team</p>
      `,
    },
    rejected: {
      text: `Hi ${name},\n\nThank you for your interest in "${postingTitle}". After careful review, we've decided to move forward with other candidates.\n\nWe appreciate your time and wish you the best.\n\nBest regards,\nThe Humans Team`,
      html: `
        <h2>Application update</h2>
        <p>Hi ${name},</p>
        <p>Thank you for your interest in <strong>"${postingTitle}"</strong>. After careful review, we've decided to move forward with other candidates.</p>
        <p>We appreciate your time and wish you the best.</p>
        <p>Best regards,<br>The Humans Team</p>
      `,
    },
  };

  await sendEmailWithOutbox({
    to: email,
    subject: subjects[type],
    ...messages[type],
  });
}

export default router;
