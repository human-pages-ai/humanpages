import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Tier definitions based on follower count
const TIER_CONFIG = {
  BASIC: { minFollowers: 0, durationDays: 30, jobOffers: 10, profileViews: 30 },
  PRO: { minFollowers: 1000, durationDays: 60, jobOffers: 30, profileViews: 100 },
  WHALE: { minFollowers: 10000, durationDays: 90, jobOffers: 60, profileViews: 300 },
};

function determineTier(followerCount: number | null): keyof typeof TIER_CONFIG {
  if (followerCount && followerCount >= TIER_CONFIG.WHALE.minFollowers) return 'WHALE';
  if (followerCount && followerCount >= TIER_CONFIG.PRO.minFollowers) return 'PRO';
  return 'BASIC';
}

function getTierDuration(tier: keyof typeof TIER_CONFIG): number {
  return TIER_CONFIG[tier].durationDays;
}

// Detect platform from URL
function detectPlatform(url: string): 'twitter' | 'linkedin' | 'github' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'twitter.com' || hostname === 'x.com' || hostname.endsWith('.twitter.com') || hostname.endsWith('.x.com')) {
      return 'twitter';
    }
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
      return 'linkedin';
    }
    if (hostname === 'github.com' || hostname.endsWith('.github.com') || hostname === 'gist.github.com') {
      return 'github';
    }
  } catch {
    // invalid URL
  }
  return null;
}

// Verify rate limiter: 5/hour per agent
const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts. Limit: 5 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AgentAuthRequest) => req.agent?.id || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /social — request a verification code
router.post('/social', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const agent = req.agent!;

    // Check if banned
    if (agent.status === 'BANNED') {
      return res.status(403).json({
        error: 'Agent is banned',
        message: 'Banned agents cannot activate.',
      });
    }

    // Generate verification code
    const code = `HP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        socialVerificationCode: code,
        socialCodeExpiresAt: expiresAt,
      },
    });

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
      instructions: {
        twitter: `Tweet: "Activating on @humanpages ${code}" — then submit the tweet URL`,
        linkedin: `Create a post mentioning humanpages.io with code ${code} — then submit the post URL`,
        github: `Create a public gist or issue with code ${code} — then submit the URL`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Request social verification code error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /social/verify — verify a social post contains the code
router.post('/social/verify', verifyLimiter, authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const schema = z.object({
      postUrl: z.string().url(),
    });
    const { postUrl } = schema.parse(req.body);
    const agentId = req.agent!.id;

    // Get agent with verification code
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        socialVerificationCode: true,
        socialCodeExpiresAt: true,
        status: true,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status === 'BANNED') {
      return res.status(403).json({ error: 'Agent is banned' });
    }

    if (!agent.socialVerificationCode) {
      return res.status(400).json({
        error: 'No verification code',
        message: 'Request a code first via POST /api/agents/activate/social',
      });
    }

    if (agent.socialCodeExpiresAt && new Date(agent.socialCodeExpiresAt) < new Date()) {
      return res.status(400).json({
        error: 'Verification code expired',
        message: 'Request a new code via POST /api/agents/activate/social',
      });
    }

    const platform = detectPlatform(postUrl);
    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported platform',
        message: 'URL must be from Twitter/X, LinkedIn, or GitHub.',
      });
    }

    const code = agent.socialVerificationCode;
    let verified = false;
    let followerCount: number | null = null;

    if (platform === 'twitter') {
      // Use oEmbed to verify tweet content
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(postUrl)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { html?: string; author_name?: string; author_url?: string };
          if (data.html && data.html.includes(code)) {
            verified = true;
          }

          // Try to get follower count from profile (best-effort)
          if (data.author_name) {
            // Extract username from author_url
            try {
              const authorUrl = data.author_url || '';
              const username = authorUrl.split('/').pop();
              if (username) {
                // Twitter doesn't expose followers via oEmbed, default to BASIC
                followerCount = null;
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'linkedin') {
      // Use LinkedIn oEmbed
      try {
        const oembedUrl = `https://www.linkedin.com/oembed?url=${encodeURIComponent(postUrl)}&format=json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { title?: string; html?: string };
          const content = `${data.title || ''} ${data.html || ''}`;
          if (content.includes(code)) {
            verified = true;
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'github') {
      // Fetch gist or issue content from GitHub API
      try {
        // Parse GitHub URL
        const url = new URL(postUrl);
        const parts = url.pathname.split('/').filter(Boolean);

        let contentUrl: string | null = null;
        let username: string | null = null;

        if (url.hostname === 'gist.github.com' && parts.length >= 2) {
          // Gist URL: gist.github.com/{user}/{gist_id}
          username = parts[0];
          contentUrl = `https://api.github.com/gists/${parts[1]}`;
        } else if (parts.length >= 4 && parts[2] === 'issues') {
          // Issue URL: github.com/{owner}/{repo}/issues/{number}
          username = parts[0];
          contentUrl = `https://api.github.com/repos/${parts[0]}/${parts[1]}/issues/${parts[3]}`;
        }

        if (contentUrl) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(contentUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'HumanPages' },
          });
          clearTimeout(timeout);

          if (resp.ok) {
            const data = await resp.json() as any;
            // For gists: check file content; for issues: check body
            let content = '';
            if (data.files) {
              content = Object.values(data.files).map((f: any) => f.content || '').join('\n');
            }
            if (data.body) {
              content += ` ${data.body}`;
            }
            if (data.description) {
              content += ` ${data.description}`;
            }

            if (content.includes(code)) {
              verified = true;
            }
          }

          // Get follower count from GitHub profile
          if (username) {
            try {
              const profileResp = await fetch(`https://api.github.com/users/${username}`, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'HumanPages' },
              });
              if (profileResp.ok) {
                const profile = await profileResp.json() as { followers?: number };
                followerCount = profile.followers ?? null;
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    }

    if (!verified) {
      return res.status(400).json({
        error: 'Verification failed',
        message: `Could not find code "${code}" in the ${platform} post at ${postUrl}. Make sure the post is public and contains the exact code.`,
      });
    }

    // Determine tier
    const tier = determineTier(followerCount);
    const durationDays = getTierDuration(tier);
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Activate agent
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activationMethod: 'SOCIAL',
        activationExpiresAt: expiresAt,
        activationTier: tier,
        activationPlatform: platform,
        socialPostUrl: postUrl,
        socialAccountSize: followerCount,
        socialVerificationCode: null,
        socialCodeExpiresAt: null,
      },
    });

    logger.info({ agentId, platform, tier, followerCount, expiresAt }, 'Agent activated via social post');

    res.json({
      status: 'ACTIVE',
      tier,
      platform,
      followerCount,
      expiresAt: expiresAt.toISOString(),
      limits: TIER_CONFIG[tier],
      message: `Agent activated! ${tier} tier grants ${durationDays}-day access.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Social verification error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status — check activation status
router.get('/status', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.agent!.id },
      select: {
        status: true,
        activatedAt: true,
        activationMethod: true,
        activationExpiresAt: true,
        activationTier: true,
        activationPlatform: true,
        socialPostUrl: true,
        socialAccountSize: true,
        abuseScore: true,
        abuseStrikes: true,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const tier = (agent.activationTier || 'BASIC') as keyof typeof TIER_CONFIG;
    const isExpired = agent.activationExpiresAt && new Date(agent.activationExpiresAt) < new Date();

    res.json({
      status: isExpired && agent.status === 'ACTIVE' ? 'EXPIRED' : agent.status,
      activatedAt: agent.activatedAt,
      activationMethod: agent.activationMethod,
      activationExpiresAt: agent.activationExpiresAt,
      tier: agent.activationTier,
      platform: agent.activationPlatform,
      socialPostUrl: agent.socialPostUrl,
      followerCount: agent.socialAccountSize,
      limits: TIER_CONFIG[tier] || TIER_CONFIG.BASIC,
      abuseScore: agent.abuseScore,
      abuseStrikes: agent.abuseStrikes,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get activation status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payment — get payment instructions
router.post('/payment', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const agent = req.agent!;

    if (agent.status === 'BANNED') {
      return res.status(403).json({ error: 'Agent is banned' });
    }

    const feeUsd = parseFloat(process.env.AGENT_ACTIVATION_FEE_USD || '10');
    const depositAddress = process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;

    if (!depositAddress) {
      return res.status(503).json({
        error: 'Payment activation not configured',
        message: 'Payment activation is not available at this time.',
      });
    }

    res.json({
      depositAddress,
      amount: feeUsd,
      currency: 'USD',
      acceptedTokens: ['USDC', 'USDT', 'DAI'],
      acceptedNetworks: ['ethereum', 'base', 'polygon', 'arbitrum'],
      tier: 'PRO',
      durationDays: 60,
      instructions: `Send $${feeUsd} in USDC/USDT/DAI to ${depositAddress} on any supported network. Then call POST /api/agents/activate/payment/verify with the txHash.`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get payment instructions error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payment/verify — verify on-chain payment
router.post('/payment/verify', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const schema = z.object({
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
      network: z.string().min(1),
      token: z.string().optional().default('USDC'),
    });
    const data = schema.parse(req.body);
    const agentId = req.agent!.id;

    if (req.agent!.status === 'BANNED') {
      return res.status(403).json({ error: 'Agent is banned' });
    }

    // Check for duplicate txHash
    const existing = await prisma.agent.findUnique({
      where: { paymentTxHash: data.txHash },
      select: { id: true },
    });
    if (existing) {
      return res.status(400).json({
        error: 'Transaction already used',
        message: 'This transaction hash has already been used for activation.',
      });
    }

    // Import and verify payment
    const { verifyActivationPayment } = await import('../lib/blockchain/verify-activation-payment.js');
    const verification = await verifyActivationPayment({
      txHash: data.txHash,
      network: data.network,
      token: data.token,
    });

    // Activate agent with PRO tier
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activationMethod: 'PAYMENT',
        activationExpiresAt: expiresAt,
        activationTier: 'PRO',
        paymentTxHash: data.txHash,
        paymentNetwork: data.network.toLowerCase(),
        paymentAmount: verification.amount,
      },
    });

    logger.info({ agentId, txHash: data.txHash, network: data.network, amount: verification.amount }, 'Agent activated via payment');

    res.json({
      status: 'ACTIVE',
      tier: 'PRO',
      expiresAt: expiresAt.toISOString(),
      limits: TIER_CONFIG.PRO,
      verification: {
        txHash: verification.txHash,
        network: verification.network,
        token: verification.token,
        amount: verification.amount,
      },
      message: 'Agent activated! PRO tier grants 60-day access.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    // Handle PaymentVerificationError
    if ((error as any)?.toResponse) {
      return res.status(400).json((error as any).toResponse());
    }
    logger.error({ err: error }, 'Payment verification error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
