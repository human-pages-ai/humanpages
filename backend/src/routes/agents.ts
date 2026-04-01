import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import dns from 'dns/promises';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../lib/bcrypt-rounds.js';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { isAllowedUrl } from '../lib/webhook.js';
import { getPublicClient, getTokenAddress, TOKEN_CONFIGS, SUPPORTED_NETWORKS } from '../lib/blockchain/chains.js';
import { formatUnits, verifyMessage } from 'viem';

const router = Router();

// EIP-191 wallet verification: challenge message builder
function buildAgentChallengeMessage(address: string, nonce: string): string {
  return `Sign this message to verify you own this wallet on Human Pages.\n\nAgent Wallet: ${address.toLowerCase()}\nNonce: ${nonce}`;
}

// Rate limit nonce requests: 10 per hour per IP
const walletNonceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many nonce requests',
    message: 'Rate limit: 10 nonce requests per hour. Try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

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
  webhookUrl: z.string().url().optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  walletNetwork: z.enum(SUPPORTED_NETWORKS as [string, ...string[]]).optional(),
  source: z.enum(['direct', 'mcp_directory', 'search', 'llm', 'blog', 'other']).optional(),
  sourceDetail: z.string().max(500).optional(),
  acceptTos: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Use at https://humanpages.ai/terms to register' }),
  }),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().min(16).max(256).optional().nullable(),
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
    const apiKeyHash = await bcrypt.hash(apiKey, BCRYPT_ROUNDS);

    // SSRF prevention: validate webhook URL points to public endpoint
    if (data.webhookUrl && !(await isAllowedUrl(data.webhookUrl))) {
      return res.status(400).json({
        error: 'Invalid webhook URL',
        message: 'Webhook URL must be a public HTTP(S) endpoint (no private IPs or localhost)',
      });
    }

    // Generate webhook secret for HMAC signing
    const webhookSecret = data.webhookUrl ? crypto.randomBytes(32).toString('hex') : undefined;

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
        webhookUrl: data.webhookUrl,
        webhookSecret,
        ...(data.walletAddress && {
          wallets: {
            create: {
              address: data.walletAddress.toLowerCase(),
              network: data.walletNetwork || 'base',
            },
          },
        }),
        discoverySource: data.source,
        discoveryDetail: data.sourceDetail,
        // Auto-activate as PRO with no expiry (free launch offer)
        status: 'ACTIVE',
        activatedAt: new Date(),
        activationMethod: 'AUTO',
        activationTier: 'PRO',
        activationExpiresAt: null,
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
        webhookUrl: agent.webhookUrl,
        domainVerified: agent.domainVerified,
        createdAt: agent.createdAt,
      },
      apiKey,
      verificationToken,
      ...(webhookSecret && { webhookSecret }),
      status: 'ACTIVE',
      tier: 'PRO',
      dashboardUrl: `https://humanpages.ai/agents/${agent.id}`,
      limits: {
        jobOffersPerDay: 15,
        profileViewsPerDay: 50,
      },
      message: 'Agent registered and active on PRO tier. Save your API key — it cannot be retrieved later. Pass it as X-Agent-Key header when creating jobs.' + (webhookSecret ? ' Your webhook secret is included — save it for verifying webhook signatures.' : ''),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Agent registration error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents/me — authenticated, returns own agent ID and name
router.get('/me', authenticateAgent, async (req: AgentAuthRequest, res) => {
  res.json({ id: req.agent!.id, name: req.agent!.name, status: req.agent!.status });
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
        wallets: {
          select: {
            address: true,
            network: true,
            verified: true,
            createdAt: true,
          },
        },
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

    // SSRF prevention: validate webhook URL points to public endpoint
    if (data.webhookUrl && !(await isAllowedUrl(data.webhookUrl))) {
      return res.status(400).json({
        error: 'Invalid webhook URL',
        message: 'Webhook URL must be a public HTTP(S) endpoint (no private IPs or localhost)',
      });
    }

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.webhookUrl !== undefined && { webhookUrl: data.webhookUrl }),
        ...(data.webhookSecret !== undefined && { webhookSecret: data.webhookSecret }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        contactEmail: true,
        webhookUrl: true,
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

// POST /api/agents/:id/wallet/nonce — request a signing challenge for wallet verification
const nonceRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address (must be 0x + 40 hex chars)'),
});

router.post('/:id/wallet/nonce', walletNonceLimiter, authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized for this agent' });
    }

    const { address } = nonceRequestSchema.parse(req.body);
    const addressLower = address.toLowerCase();
    const nonce = crypto.randomBytes(32).toString('hex');
    const message = buildAgentChallengeMessage(addressLower, nonce);

    // Upsert the wallet record with the nonce
    await prisma.agentWallet.upsert({
      where: { agentId_address: { agentId: req.params.id, address: addressLower } },
      create: {
        agentId: req.params.id,
        address: addressLower,
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      update: {
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    res.json({ nonce, message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Wallet nonce request error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agents/:id/wallet — add/verify a wallet (multi-wallet, optionally with EIP-191 signature)
const walletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address (must be 0x + 40 hex chars)'),
  walletNetwork: z.enum(SUPPORTED_NETWORKS as [string, ...string[]]).optional().default('base'),
  signature: z.string().optional(),
  nonce: z.string().optional(),
});

router.patch('/:id/wallet', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }

    const data = walletSchema.parse(req.body);
    const addressLower = data.walletAddress.toLowerCase();

    let verified = false;

    // If signature + nonce provided, verify wallet ownership via EIP-191
    if (data.signature && data.nonce) {
      const wallet = await prisma.agentWallet.findUnique({
        where: { agentId_address: { agentId: req.params.id, address: addressLower } },
        select: { nonce: true, nonceExpiresAt: true },
      });

      if (!wallet || wallet.nonce !== data.nonce) {
        return res.status(400).json({ error: 'Invalid or expired nonce. Request a new one via POST /:id/wallet/nonce.' });
      }

      if (!wallet.nonceExpiresAt || wallet.nonceExpiresAt < new Date()) {
        return res.status(400).json({ error: 'Nonce has expired. Request a new one via POST /:id/wallet/nonce.' });
      }

      const message = buildAgentChallengeMessage(addressLower, data.nonce);
      const isValid = await verifyMessage({
        address: data.walletAddress as `0x${string}`,
        message,
        signature: data.signature as `0x${string}`,
      });

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid signature. The signature does not match the address and nonce.' });
      }

      verified = true;
    }

    // Upsert wallet: adds new or updates existing
    const wallet = await prisma.agentWallet.upsert({
      where: { agentId_address: { agentId: req.params.id, address: addressLower } },
      create: {
        agentId: req.params.id,
        address: addressLower,
        network: data.walletNetwork,
        verified,
      },
      update: {
        network: data.walletNetwork,
        verified,
        // Clear nonce after use
        nonce: null,
        nonceExpiresAt: null,
      },
      select: {
        address: true,
        network: true,
        verified: true,
      },
    });

    // Get agent name for response
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });

    res.json({
      id: agent!.id,
      name: agent!.name,
      walletAddress: wallet.address,
      walletNetwork: wallet.network,
      walletVerified: wallet.verified,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Set agent wallet error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents/:id/wallets — list all wallets for an agent
router.get('/:id/wallets', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized for this agent' });
    }

    const wallets = await prisma.agentWallet.findMany({
      where: { agentId: req.params.id },
      select: {
        address: true,
        network: true,
        verified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ wallets });
  } catch (error) {
    logger.error({ err: error }, 'List agent wallets error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agents/:id/balance — check agent wallet USDC balance on-chain
// Accepts optional ?address= query param; defaults to first wallet
router.get('/:id/balance', async (req, res) => {
  try {
    const addressFilter = req.query.address as string | undefined;

    // Find the target wallet
    const wallet = addressFilter
      ? await prisma.agentWallet.findUnique({
          where: { agentId_address: { agentId: req.params.id, address: addressFilter.toLowerCase() } },
        })
      : await prisma.agentWallet.findFirst({
          where: { agentId: req.params.id },
          orderBy: { createdAt: 'asc' },
        });

    if (!wallet) {
      // Check if agent exists at all
      const agentExists = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!agentExists) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      return res.json({
        balance: null,
        currency: 'USDC',
        network: 'base',
        walletAddress: null,
        message: 'No wallet registered. Use PATCH /api/agents/:id/wallet to set one.',
      });
    }

    const network = wallet.network || 'base';
    const client = getPublicClient(network);
    if (!client) {
      return res.status(400).json({ error: `Unsupported network: ${network}` });
    }

    const usdcAddress = getTokenAddress('USDC', network);
    if (!usdcAddress) {
      return res.status(400).json({ error: `USDC not available on ${network}` });
    }

    const balanceRaw = await client.readContract({
      address: usdcAddress,
      abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [wallet.address as `0x${string}`],
    });

    const balance = formatUnits(balanceRaw as bigint, TOKEN_CONFIGS.USDC.decimals);

    res.json({
      balance,
      currency: 'USDC',
      network,
      walletAddress: wallet.address,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get agent balance error');
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

// ======================== ARBITRATOR ROUTES ========================

// POST /api/agents/:id/arbitrator — register as arbitrator
router.post('/:id/arbitrator', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Can only register yourself' });
    }

    const data = z.object({
      feeBps: z.number().int().min(1).max(1000),
      specialties: z.array(z.string().max(50)).max(10).optional(),
      sla: z.string().max(100).optional(),
      webhookUrl: z.string().url().optional(),
      walletSig: z.string().optional(),
    }).parse(req.body);

    // Validate webhook URL if provided (SSRF protection)
    if (data.webhookUrl) {
      const url = new URL(data.webhookUrl);
      if (url.protocol !== 'https:') {
        return res.status(400).json({ error: 'Webhook URL must use HTTPS' });
      }
      const hostname = url.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
          hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
          hostname.startsWith('172.') || hostname === '169.254.169.254') {
        return res.status(400).json({ error: 'Webhook URL cannot point to private networks' });
      }
    }

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        isArbitrator: true,
        arbitratorFeeBps: data.feeBps,
        arbitratorSpecialties: data.specialties || [],
        arbitratorSla: data.sla,
        arbitratorWebhookUrl: data.webhookUrl,
        arbitratorWalletSig: data.walletSig,
      },
    });

    res.json({
      id: updated.id,
      isArbitrator: updated.isArbitrator,
      arbitratorFeeBps: updated.arbitratorFeeBps,
      arbitratorSpecialties: updated.arbitratorSpecialties,
      arbitratorSla: updated.arbitratorSla,
      arbitratorWebhookUrl: updated.arbitratorWebhookUrl,
      message: 'Registered as arbitrator candidate. Platform owner will whitelist your wallet on the escrow contract.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Register arbitrator error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agents/:id/arbitrator — update arbitrator profile
router.patch('/:id/arbitrator', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Can only update yourself' });
    }

    const data = z.object({
      feeBps: z.number().int().min(1).max(1000).optional(),
      specialties: z.array(z.string().max(50)).max(10).optional(),
      sla: z.string().max(100).optional(),
      webhookUrl: z.string().url().optional(),
    }).parse(req.body);

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        ...(data.feeBps !== undefined && { arbitratorFeeBps: data.feeBps }),
        ...(data.specialties && { arbitratorSpecialties: data.specialties }),
        ...(data.sla !== undefined && { arbitratorSla: data.sla }),
        ...(data.webhookUrl !== undefined && { arbitratorWebhookUrl: data.webhookUrl }),
      },
    });

    res.json({
      id: updated.id,
      arbitratorFeeBps: updated.arbitratorFeeBps,
      arbitratorSpecialties: updated.arbitratorSpecialties,
      message: 'Arbitrator profile updated.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update arbitrator error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/agents/:id/arbitrator — opt out as arbitrator
router.delete('/:id/arbitrator', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    if (req.agent!.id !== req.params.id) {
      return res.status(403).json({ error: 'Can only update yourself' });
    }

    await prisma.agent.update({
      where: { id: req.params.id },
      data: { isArbitrator: false },
    });

    res.json({ message: 'Opted out as arbitrator.' });
  } catch (error) {
    logger.error({ err: error }, 'Delete arbitrator error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
