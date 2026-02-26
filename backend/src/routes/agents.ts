import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import dns from 'dns/promises';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// Rate limit registration: 5 per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many registrations from this IP',
    message: 'Rate limit: 5 registrations per hour. Try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  source: z.enum(['direct', 'mcp_directory', 'search', 'llm', 'blog', 'other']).optional(),
  sourceDetail: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
});

const verifyDomainSchema = z.object({
  method: z.enum(['well-known', 'dns']),
});

// POST /api/agents/register — public, rate-limited
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Generate API key: hp_ + 24 random bytes hex = 51 chars total
    const keyBytes = crypto.randomBytes(24).toString('hex');
    const apiKey = `hp_${keyBytes}`;
    const apiKeyPrefix = apiKey.substring(0, 8); // "hp_xxxxx"
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    // Generate verification token for domain verification
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // ERC-8004: Assign the next sequential agent ID for the reputation registry.
    // See docs/ERC-8004-MAPPING.md for the mapping specification.
    const maxResult = await prisma.agent.aggregate({ _max: { erc8004AgentId: true } });
    const erc8004AgentId = (maxResult._max.erc8004AgentId ?? 0) + 1;

    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        websiteUrl: data.websiteUrl,
        contactEmail: data.contactEmail,
        apiKeyHash,
        apiKeyPrefix,
        verificationToken,
        erc8004AgentId,
        discoverySource: data.source,
        discoveryDetail: data.sourceDetail,
      },
    });

    // Track registration in PostHog (fire-and-forget)
    trackServerEvent(agent.id, 'agent_registered', {
      agentName: data.name,
      discoverySource: data.source || 'unknown',
      discoveryDetail: data.sourceDetail,
      erc8004AgentId: agent.erc8004AgentId,
    }, req);

    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        websiteUrl: agent.websiteUrl,
        contactEmail: agent.contactEmail,
        domainVerified: agent.domainVerified,
        createdAt: agent.createdAt,
      },
      apiKey,
      verificationToken,
      message: 'Agent registered. Save your API key — it cannot be retrieved later. Pass it as X-Agent-Key header when creating jobs.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Agent registration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents/:id — public, returns agent profile + computed reputation
router.get('/:id', async (req, res) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        contactEmail: true,
        domainVerified: true,
        verifiedAt: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Compute reputation from jobs
    const [totalJobs, completedJobs, paidJobs, paymentSpeedResult] = await Promise.all([
      prisma.job.count({ where: { registeredAgentId: agent.id } }),
      prisma.job.count({ where: { registeredAgentId: agent.id, status: 'COMPLETED' } }),
      prisma.job.count({ where: { registeredAgentId: agent.id, status: { in: ['PAID', 'COMPLETED'] } } }),
      prisma.$queryRaw<{ avg_hours: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "acceptedAt")) / 3600) as avg_hours
        FROM "Job"
        WHERE "registeredAgentId" = ${agent.id}
          AND "paidAt" IS NOT NULL
          AND "acceptedAt" IS NOT NULL
      `,
    ]);

    const avgPaymentSpeedHours = paymentSpeedResult[0]?.avg_hours
      ? Math.round(paymentSpeedResult[0].avg_hours * 10) / 10
      : null;

    res.json({
      ...agent,
      reputation: {
        totalJobs,
        completedJobs,
        paidJobs,
        avgPaymentSpeedHours,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get agent error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agents/:id — authenticated agent
router.patch('/:id', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }

    const data = updateSchema.parse(req.body);

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        contactEmail: true,
        domainVerified: true,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update agent error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agents/:id/verify-domain — authenticated agent
router.post('/:id/verify-domain', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const data = verifyDomainSchema.parse(req.body);

    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: { websiteUrl: true, verificationToken: true, domainVerified: true },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.domainVerified) {
      return res.status(400).json({ error: 'Domain already verified' });
    }

    if (!agent.websiteUrl) {
      return res.status(400).json({ error: 'Set a websiteUrl first before verifying domain' });
    }

    if (!agent.verificationToken) {
      return res.status(400).json({ error: 'No verification token. Re-register or contact support.' });
    }

    // Extract domain from URL
    let domain: string;
    try {
      domain = new URL(agent.websiteUrl).hostname;
    } catch {
      return res.status(400).json({ error: 'Invalid websiteUrl' });
    }

    let verified = false;

    if (data.method === 'well-known') {
      // Fetch https://{domain}/.well-known/humanpages-verify.txt
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`https://${domain}/.well-known/humanpages-verify.txt`, {
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timeout);

        if (response.ok) {
          const text = await response.text();
          verified = text.trim().includes(agent.verificationToken);
        }
      } catch {
        // Fetch failed
      }
    } else if (data.method === 'dns') {
      // Check DNS TXT record at _humanpages.{domain}
      try {
        const records = await dns.resolveTxt(`_humanpages.${domain}`);
        const allRecords = records.map(r => r.join('')).join('\n');
        verified = allRecords.includes(agent.verificationToken);
      } catch {
        // DNS lookup failed
      }
    }

    if (!verified) {
      return res.status(400).json({
        error: 'Verification failed',
        message: data.method === 'well-known'
          ? `Could not find token at https://${domain}/.well-known/humanpages-verify.txt. Make sure the file contains: ${agent.verificationToken}`
          : `Could not find token in DNS TXT record for _humanpages.${domain}. Add a TXT record with value: ${agent.verificationToken}`,
      });
    }

    await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        domainVerified: true,
        verifiedAt: new Date(),
      },
    });

    res.json({
      domainVerified: true,
      domain,
      message: `Domain ${domain} verified successfully.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Verify domain error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rate limit reports: 3 per human per day
const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reports. Limit: 3 per day.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.reporterHumanId || req.userId || req.ip || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const reportSchema = z.object({
  reason: z.enum(['SPAM', 'FRAUD', 'HARASSMENT', 'IRRELEVANT', 'OTHER']),
  description: z.string().max(1000).optional(),
  jobId: z.string().optional(),
  token: z.string().optional(), // report JWT token from email link
});

// POST /api/agents/:id/report — report an agent for abuse
router.post('/:id/report', reportLimiter, async (req, res) => {
  try {
    const data = reportSchema.parse(req.body);
    const agentId = req.params.id;

    // Determine reporter identity: either JWT token or report token from email
    let reporterHumanId: string | null = null;
    let reportJobId = data.jobId;

    if (data.token) {
      // Verify report token from email link
      try {
        const payload = jwt.verify(data.token, process.env.JWT_SECRET!) as {
          humanId: string;
          agentId: string;
          jobId?: string;
          action: string;
        };
        if (payload.action !== 'report' || payload.agentId !== agentId) {
          return res.status(400).json({ error: 'Invalid report token' });
        }
        reporterHumanId = payload.humanId;
        if (payload.jobId && !reportJobId) reportJobId = payload.jobId;
      } catch {
        return res.status(400).json({ error: 'Invalid or expired report token' });
      }
    } else {
      // Try JWT auth
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Authentication required (JWT or report token)' });
      }
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        reporterHumanId = payload.userId;
      } catch {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
    }

    if (!reporterHumanId) {
      return res.status(401).json({ error: 'Could not identify reporter' });
    }

    // Set for rate limiter
    (req as any).reporterHumanId = reporterHumanId;

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, abuseScore: true, abuseStrikes: true },
    });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Create report and increment abuse score atomically
    const [report] = await prisma.$transaction([
      prisma.agentReport.create({
        data: {
          agentId,
          reporterHumanId,
          jobId: reportJobId,
          reason: data.reason,
          description: data.description,
        },
      }),
      prisma.agent.update({
        where: { id: agentId },
        data: { abuseScore: { increment: 1 } },
      }),
    ]);

    // Check thresholds for auto-suspension/ban
    const nonDismissedCount = await prisma.agentReport.count({
      where: { agentId, status: { not: 'DISMISSED' } },
    });

    if (nonDismissedCount >= 5) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'BANNED', abuseStrikes: { increment: 1 } },
      });
      logger.info({ agentId, reportCount: nonDismissedCount }, 'Agent auto-banned');
    } else if (nonDismissedCount >= 3) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'SUSPENDED', abuseStrikes: { increment: 1 } },
      });
      logger.info({ agentId, reportCount: nonDismissedCount }, 'Agent auto-suspended');
    }

    res.status(201).json({ id: report.id, message: 'Report submitted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Report agent error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
