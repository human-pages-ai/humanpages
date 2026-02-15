import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';

const router = Router();

// ─── Rate limiter: 5 submissions per 15 minutes per IP ───
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many feedback submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// ─── Zod schema for validation ───
const feedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE', 'FEEDBACK']).default('FEEDBACK'),
  category: z.string().max(50).optional(),
  title: z.string().max(200).optional(),
  description: z.string().min(1, 'Description is required').max(5000),
  sentiment: z.number().int().min(1).max(5).optional(),

  // Bug-report fields
  stepsToReproduce: z.string().max(2000).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior: z.string().max(1000).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),

  // Auto-captured context
  pageUrl: z.string().max(500).optional(),
  browser: z.string().max(200).optional(),
  os: z.string().max(200).optional(),
  viewport: z.string().max(20).optional(),
  userAgent: z.string().max(500).optional(),
  appVersion: z.string().max(50).optional(),
  screenshotData: z.string().max(2 * 1024 * 1024).optional(), // ~2MB max base64
});

// ─── Optional auth middleware: attaches userId if token present, but doesn't reject ───
async function optionalAuth(req: AuthRequest, _res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; iat: number };
      const user = await prisma.human.findUnique({
        where: { id: payload.userId },
        select: { tokenInvalidatedAt: true },
      });
      if (user) {
        if (!user.tokenInvalidatedAt || payload.iat * 1000 >= user.tokenInvalidatedAt.getTime()) {
          req.userId = payload.userId;
        }
      }
    } catch {
      // Token invalid — continue as anonymous
    }
  }
  next();
}

// ─── POST /api/feedback — Submit feedback (auth optional) ───
router.post('/', feedbackLimiter, optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid feedback data',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    const feedback = await prisma.feedback.create({
      data: {
        humanId: req.userId || null,
        type: data.type,
        category: data.category || null,
        title: data.title || null,
        description: data.description,
        sentiment: data.sentiment ?? null,
        stepsToReproduce: data.stepsToReproduce || null,
        expectedBehavior: data.expectedBehavior || null,
        actualBehavior: data.actualBehavior || null,
        severity: data.severity || null,
        pageUrl: data.pageUrl || null,
        browser: data.browser || null,
        os: data.os || null,
        viewport: data.viewport || null,
        userAgent: data.userAgent || null,
        appVersion: data.appVersion || null,
        screenshotData: data.screenshotData || null,
      },
    });

    logger.info(
      { feedbackId: feedback.id, type: data.type, userId: req.userId || 'anonymous' },
      'Feedback submitted'
    );

    // Send email notification to admin (fire-and-forget)
    sendAdminNotification(feedback).catch((err) =>
      logger.warn({ err }, 'Failed to send feedback notification email')
    );

    res.status(201).json({
      id: feedback.id,
      message: 'Thank you for your feedback! We\'ll review it soon.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Feedback submission error');
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ─── Admin endpoints ───

// GET /api/feedback/admin — List all feedback (paginated)
router.get('/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const type = req.query.type as string;

    const where: any = {};
    if (status && ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      where.status = status;
    }
    if (type && ['BUG', 'FEATURE', 'FEEDBACK'].includes(type)) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          human: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    res.json({
      feedback: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin feedback list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/feedback/admin/ai — List feedback via API key (read-only, for CLI tooling)
router.get('/admin/ai', apiKeyAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const type = req.query.type as string;

    const where: any = {};
    if (status && ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      where.status = status;
    }
    if (type && ['BUG', 'FEATURE', 'FEEDBACK'].includes(type)) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          human: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    // Strip screenshot data to keep responses small
    const cleaned = items.map(({ screenshotData, ...rest }) => rest);

    res.json({
      feedback: cleaned,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'AI admin feedback list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/feedback/admin/ai/:id — Update feedback status/notes via API key
router.patch('/admin/ai/:id', apiKeyAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updateData: any = {};
    if (status && ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      updateData.status = status;
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(feedback);
  } catch (error) {
    logger.error({ err: error }, 'AI admin feedback update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/feedback/admin/:id — Update feedback status/notes
router.patch('/admin/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, adminNotes } = req.body;

    const updateData: any = {};
    if (status && ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      updateData.status = status;
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    // If nothing valid to update, return current state
    if (Object.keys(updateData).length === 0) {
      const feedback = await prisma.feedback.findUnique({
        where: { id: req.params.id },
      });
      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      return res.json(feedback);
    }

    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(feedback);
  } catch (error) {
    logger.error({ err: error }, 'Admin feedback update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Email notification helper ───
async function sendAdminNotification(feedback: any) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL;
  if (!adminEmail) return;

  // Dynamic import to avoid circular deps
  const { Resend } = await import('resend');
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const fromEmail = process.env.FROM_EMAIL || 'hello@humanpages.ai';
  const fromName = process.env.FROM_NAME || 'HumanPages';

  const typeLabel = feedback.type === 'BUG' ? '🐛 Bug Report' : feedback.type === 'FEATURE' ? '💡 Feature Request' : '💬 Feedback';
  const severityLabel = feedback.severity ? ` [${feedback.severity.toUpperCase()}]` : '';

  await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [adminEmail],
    subject: `${typeLabel}${severityLabel}: ${feedback.title || feedback.description.slice(0, 60)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">${typeLabel}${severityLabel}</h2>
        ${feedback.title ? `<p><strong>Title:</strong> ${escapeHtml(feedback.title)}</p>` : ''}
        ${feedback.category ? `<p><strong>Category:</strong> ${escapeHtml(feedback.category)}</p>` : ''}
        <p><strong>Description:</strong></p>
        <p style="background: #f9fafb; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(feedback.description)}</p>
        ${feedback.stepsToReproduce ? `<p><strong>Steps to Reproduce:</strong></p><p style="background: #f9fafb; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(feedback.stepsToReproduce)}</p>` : ''}
        ${feedback.expectedBehavior ? `<p><strong>Expected:</strong> ${escapeHtml(feedback.expectedBehavior)}</p>` : ''}
        ${feedback.actualBehavior ? `<p><strong>Actual:</strong> ${escapeHtml(feedback.actualBehavior)}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #6b7280;">
          <strong>Page:</strong> ${feedback.pageUrl || 'N/A'}<br/>
          <strong>Browser:</strong> ${feedback.browser || 'N/A'}<br/>
          <strong>OS:</strong> ${feedback.os || 'N/A'}<br/>
          <strong>Viewport:</strong> ${feedback.viewport || 'N/A'}<br/>
          <strong>User:</strong> ${feedback.humanId || 'Anonymous'}<br/>
          <strong>ID:</strong> ${feedback.id}
        </p>
        ${feedback.screenshotData ? `<p><strong>Screenshot attached</strong></p><img src="${feedback.screenshotData}" style="max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;" />` : ''}
      </div>
    `,
    text: `${typeLabel}${severityLabel}\n\n${feedback.title || ''}\n\n${feedback.description}\n\nPage: ${feedback.pageUrl || 'N/A'}\nBrowser: ${feedback.browser || 'N/A'}\nOS: ${feedback.os || 'N/A'}\nUser: ${feedback.humanId || 'Anonymous'}`,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default router;
