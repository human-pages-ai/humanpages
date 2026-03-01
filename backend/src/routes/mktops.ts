import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ─── Daemon writes (API key auth) ───

// POST /api/admin/mktops/log — insert a log entry
router.post('/log', apiKeyAdmin, async (req, res) => {
  try {
    const { event, staff, prompt, response, model, durationMs, details } = req.body;
    if (!event) return res.status(400).json({ error: 'event is required' });

    const entry = await prisma.mktOpsLog.create({
      data: {
        event,
        staff: staff ?? null,
        prompt: prompt ?? null,
        response: response ?? null,
        model: model ?? null,
        durationMs: durationMs ?? null,
        details: details ?? {},
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    logger.error({ err: error }, 'MktOps log creation error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/mktops/decision — insert a decision
router.post('/decision', apiKeyAdmin, async (req, res) => {
  try {
    const { staff, question, context, options, telegramMsgId } = req.body;
    if (!question || !context) return res.status(400).json({ error: 'question and context are required' });

    const decision = await prisma.mktOpsDecision.create({
      data: {
        staff: staff ?? null,
        question,
        context,
        options: options ?? [],
        telegramMsgId: telegramMsgId ?? null,
      },
    });

    res.status(201).json(decision);
  } catch (error) {
    logger.error({ err: error }, 'MktOps decision creation error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PATCH /api/admin/mktops/decision/:id — resolve a decision
router.patch('/decision/:id', apiKeyAdmin, async (req, res) => {
  try {
    const { chosen, status } = req.body;

    const decision = await prisma.mktOpsDecision.update({
      where: { id: req.params.id },
      data: {
        chosen: chosen ?? undefined,
        status: status ?? 'resolved',
        resolvedAt: new Date(),
      },
    });

    res.json(decision);
  } catch (error) {
    logger.error({ err: error }, 'MktOps decision update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/mktops/config/:key — get config (API key OR admin JWT)
router.get('/config/:key', apiKeyAdmin, async (req, res) => {
  try {
    const config = await prisma.mktOpsConfig.findUnique({
      where: { key: req.params.key },
    });

    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'MktOps config get error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// ─── Dashboard reads (JWT admin auth) ───

// GET /api/admin/mktops/logs — paginated logs
router.get('/logs', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (req.query.event) where.event = req.query.event;
    if (req.query.staff) where.staff = req.query.staff;
    if (req.query.from || req.query.to) {
      where.timestamp = {
        ...(req.query.from ? { gte: new Date(req.query.from as string) } : {}),
        ...(req.query.to ? { lte: new Date(req.query.to as string) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.mktOpsLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.mktOpsLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'MktOps logs list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// GET /api/admin/mktops/decisions — paginated decisions
router.get('/decisions', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.staff) where.staff = req.query.staff;

    const [decisions, total] = await Promise.all([
      prisma.mktOpsDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.mktOpsDecision.count({ where }),
    ]);

    res.json({
      decisions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'MktOps decisions list error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// PUT /api/admin/mktops/config/:key — update config (admin only)
router.put('/config/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    const user = await prisma.human.findUnique({
      where: { id: req.userId! },
      select: { email: true },
    });

    const config = await prisma.mktOpsConfig.upsert({
      where: { key: req.params.key },
      update: {
        value,
        updatedBy: user?.email ?? req.userId,
      },
      create: {
        key: req.params.key,
        value,
        updatedBy: user?.email ?? req.userId,
      },
    });

    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'MktOps config update error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

// POST /api/admin/mktops/config/seed — seed initial config from defaults
router.post('/config/seed', apiKeyAdmin, async (_req, res) => {
  try {
    const defaults: Record<string, unknown> = {
      'staff-profiles': {
        Christopher: {
          name: 'Christopher',
          timezone: 'Africa/Algiers',
          availabilityStart: '08:00',
          availabilityEnd: '17:00',
          availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          skills: ['YouTube commenting', 'Facebook engagement', 'FB group posting'],
          level: 'basic',
          notes: 'Needs clear step-by-step instructions. Needs explicit confirmation prompts. Remind about Zoom screenshare.',
        },
        Thimmy: {
          name: 'Thimmy',
          timezone: 'Africa/Algiers',
          availabilityStart: '07:00',
          availabilityEnd: '17:00',
          availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          skills: ['YouTube commenting', 'YouTube replies', 'FB group posting', 'social media engagement', 'Reddit'],
          level: 'basic',
          notes: 'Available every day including Sundays. Has Reddit account. Got restricted by Facebook for over-posting — pace FB tasks.',
        },
        Mikee: {
          name: 'Mikee',
          timezone: 'Asia/Manila',
          availabilityStart: '13:00',
          availabilityEnd: '22:00',
          availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          skills: ['Copywriting', 'influencer outreach', 'content creation', 'FB group posting', 'meme creation', 'Google Docs/Sheets'],
          level: 'strategic',
          notes: 'Sends daily progress reports unprompted. Creates strategy docs. Can plan independently.',
        },
        Angel: {
          name: 'Angel',
          timezone: 'Asia/Manila',
          availabilityStart: '13:00',
          availabilityEnd: '17:00',
          availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          skills: ['Cross-posting blogs', 'Dev.to', 'Hashnode', 'HackerNoon', 'Medium', 'Reddit', 'Vocal Media', 'Indie Hackers', 'Twitter/X developer setup', 'API key management', 'Facebook page admin', 'LinkedIn'],
          level: 'technical',
          notes: 'Most technically capable. Handles OAuth, API keys, developer portals, browser extensions.',
        },
      },
      strategy: {
        focusAreas: [
          'Human Pages signups growth',
          'Social media awareness and engagement',
          'Developer community outreach',
          'Blog cross-posting for SEO',
          'YouTube engagement on AI/crypto/job-related content',
          'Facebook group posting in freelance/job communities',
          'Influencer outreach for awareness',
        ],
        platformPriorities: [
          'Facebook groups',
          'YouTube comments',
          'Reddit',
          'Dev.to / Hashnode / Medium',
          'Twitter/X',
          'LinkedIn',
          'Indie Hackers',
        ],
        maxTasksPerPersonPerDay: 5,
        maxFollowUpsBeforeEscalation: 3,
        followUpIntervalHours: 2,
      },
      'daily-procedures': {
        morningBriefingTemplate: 'Send greeting, review active Linear tasks, prioritize top tasks for the day, remind about Zoom screen sharing and clocking in.',
        greetingReminders: 'On greeting/clock-in: remind to clock in at humanpages.ai/admin, create Zoom meeting with screen sharing, send link to Admin.',
        followUpStyle: 'Brief and friendly check-in. Ask how current task is going and if they need help. First follow-up includes Zoom screen sharing reminder.',
        eodQuestions: [
          'What you worked on and what went well',
          'What didn\'t go as planned',
          'Whether you\'re blocked or need help',
          'What you plan to work on tomorrow (becomes starting point for next day)',
        ],
        eodReminders: 'Validate EOD report covers all 4 points. If tomorrow\'s plan is missing, nudge before they sign off. Remind to clock out.',
      },
    };

    const results: Record<string, string> = {};

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await prisma.mktOpsConfig.findUnique({ where: { key } });
      if (existing) {
        results[key] = 'already exists';
      } else {
        await prisma.mktOpsConfig.create({ data: { key, value: value as any } });
        results[key] = 'seeded';
      }
    }

    res.json({ results });
  } catch (error) {
    logger.error({ err: error }, 'MktOps config seed error');
    res.status(500).json({ error: 'Internal server error', detail: errMsg(error) });
  }
});

export default router;
