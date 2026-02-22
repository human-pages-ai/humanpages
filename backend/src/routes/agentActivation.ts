import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { logger } from '../lib/logger.js';
import { isX402Enabled, X402_PRICES } from '../lib/x402.js';

const router = Router();

// Tier definitions based on follower count
// BASIC: nerfed to prevent sybil abuse. Pay-per-use via x402 fills the gap.
// PRO: volume discount via subscription.
const TIER_CONFIG = {
  BASIC: { minFollowers: 0, durationDays: null, jobOffersPerTwoDays: 1, profileViewsPerDay: 1 },
  PRO: { minFollowers: 1000, durationDays: 60, jobOffersPerDay: 15, profileViewsPerDay: 50 },
};

const LAUNCH_PROMO = { totalSlots: 100, enabled: true };

function determineTier(followerCount: number | null): keyof typeof TIER_CONFIG {
  if (followerCount && followerCount >= TIER_CONFIG.PRO.minFollowers) return 'PRO';
  return 'BASIC';
}

function getTierDuration(tier: keyof typeof TIER_CONFIG): number | null {
  return TIER_CONFIG[tier].durationDays;
}

// Supported platforms — all require phone verification, hard to mass-create
type SocialPlatform = 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook' | 'instagram' | 'telegram' | 'moltbook';

function detectPlatform(url: string): SocialPlatform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'twitter.com' || hostname === 'x.com' || hostname.endsWith('.twitter.com') || hostname.endsWith('.x.com')) {
      return 'twitter';
    }
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
      return 'linkedin';
    }
    if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
      return 'tiktok';
    }
    if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname.endsWith('.youtube.com')) {
      return 'youtube';
    }
    if (hostname === 'facebook.com' || hostname === 'www.facebook.com' || hostname === 'fb.com' || hostname.endsWith('.facebook.com')) {
      return 'facebook';
    }
    if (hostname === 'instagram.com' || hostname === 'www.instagram.com' || hostname.endsWith('.instagram.com')) {
      return 'instagram';
    }
    if (hostname === 't.me' || hostname === 'telegram.me') {
      return 'telegram';
    }
    if (hostname === 'moltbook.com' || hostname === 'www.moltbook.com') {
      return 'moltbook';
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

    const link = 'https://humanpages.ai';
    const mention = '@HumanPagesAI';

    // Platforms that mangle links (e.g. Twitter rewrites to t.co) use @mention
    // Feature flag: Meta (Facebook/Instagram) verification requires business verification.
    // Set ENABLE_META_VERIFICATION=true once Meta business verification is approved.
    const metaEnabled = process.env.ENABLE_META_VERIFICATION === 'true' && !!process.env.META_APP_ACCESS_TOKEN;
    const platforms: string[] = ['twitter', 'linkedin', 'tiktok', 'youtube', 'telegram', 'moltbook'];
    const suggestedPosts: Record<string, string> = {
      twitter: `Just got my AI agent verified on ${mention} — the directory where AI agents hire humans for real-world tasks. ${code}`,
      linkedin: `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`,
      tiktok: `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`,
      youtube: `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`,
      telegram: `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`,
      moltbook: `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`,
    };
    const instructions: Record<string, string> = {
      twitter: `Tweet something that includes ${mention} and your code ${code}. Example: "${suggestedPosts.twitter}"`,
      linkedin: `Create a post that includes a link to ${link} and your code ${code}. Say something nice about us!`,
      tiktok: `Post a TikTok video with a caption that includes ${link} and your code ${code}.`,
      youtube: `Upload a YouTube video with a title that includes ${link} and your code ${code}.`,
      telegram: `Post in a public Telegram channel/group that includes ${link} and your code ${code}.`,
      moltbook: `Create a public Moltbook post that includes ${link} and your code ${code}.`,
    };
    if (metaEnabled) {
      platforms.push('facebook', 'instagram');
      suggestedPosts.facebook = `Just got my AI agent verified on ${link} — the directory where AI agents hire humans for real-world tasks. ${code}`;
      suggestedPosts.instagram = `Just got my AI agent verified on ${mention} — the directory where AI agents hire humans for real-world tasks. ${code}`;
      instructions.facebook = `Create a public Facebook post that includes ${link} and your code ${code}.`;
      instructions.instagram = `Create a public Instagram post with a caption that includes ${mention} and your code ${code}.`;
    }

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
      requirements: 'Post MUST contain: (1) a link to humanpages.ai or a mention of @HumanPagesAI, (2) your unique code. Posts missing either will be rejected.',
      suggestedPosts,
      platforms,
      instructions,
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
        message: 'URL must be from Twitter/X, LinkedIn, TikTok, YouTube, Facebook, Instagram, Telegram, or Moltbook.',
      });
    }

    const code = agent.socialVerificationCode;
    let verified = false;
    let mentionsUs = false;
    let followerCount: number | null = null;

    // Check if content mentions humanpages (link or @mention)
    // Based on official Linktree: https://linktr.ee/HumanPagesAI
    const checkMentionsUs = (content: string): boolean => {
      const lower = content.toLowerCase();
      return lower.includes('humanpages.ai') || lower.includes('@humanpages') || lower.includes('humanpagesai');
    };

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
            mentionsUs = checkMentionsUs(data.html);
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
            mentionsUs = checkMentionsUs(content);
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'tiktok') {
      // Use TikTok oEmbed — returns video caption in 'title' field
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { title?: string; html?: string; author_name?: string; author_url?: string };
          const content = `${data.title || ''} ${data.html || ''}`;
          if (content.includes(code)) {
            verified = true;
            mentionsUs = checkMentionsUs(content);
          }
          // TikTok oEmbed doesn't expose follower counts
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'youtube') {
      // Use YouTube oEmbed — code must be in video title
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(postUrl)}&format=json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { title?: string; html?: string; author_name?: string; author_url?: string };
          const content = `${data.title || ''} ${data.html || ''}`;
          if (content.includes(code)) {
            verified = true;
            mentionsUs = checkMentionsUs(content);
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'facebook') {
      // Meta oEmbed — requires ENABLE_META_VERIFICATION=true and META_APP_ACCESS_TOKEN
      const metaToken = process.env.ENABLE_META_VERIFICATION === 'true' ? process.env.META_APP_ACCESS_TOKEN : undefined;
      if (!metaToken) {
        return res.status(503).json({
          error: 'Facebook verification not configured',
          message: 'Facebook verification is not available at this time. Please use another platform.',
        });
      }
      try {
        const oembedUrl = `https://graph.facebook.com/oembed_post?url=${encodeURIComponent(postUrl)}&access_token=${metaToken}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { html?: string };
          const content = data.html || '';
          if (content.includes(code)) {
            verified = true;
            mentionsUs = checkMentionsUs(content);
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'instagram') {
      // Meta oEmbed — requires ENABLE_META_VERIFICATION=true and META_APP_ACCESS_TOKEN
      const metaToken = process.env.ENABLE_META_VERIFICATION === 'true' ? process.env.META_APP_ACCESS_TOKEN : undefined;
      if (!metaToken) {
        return res.status(503).json({
          error: 'Instagram verification not configured',
          message: 'Instagram verification is not available at this time. Please use another platform.',
        });
      }
      try {
        const oembedUrl = `https://graph.facebook.com/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${metaToken}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(oembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json() as { html?: string };
          const content = data.html || '';
          if (content.includes(code)) {
            verified = true;
            mentionsUs = checkMentionsUs(content);
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'telegram') {
      // Fetch Telegram embed HTML from public channel/group post
      try {
        // t.me URLs: t.me/{channel}/{msgId} → fetch embed version
        const embedUrl = `${postUrl}?embed=1&mode=tme`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(embedUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'HumanPages/1.0' },
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const html = await resp.text();
          if (html.includes(code)) {
            verified = true;
            mentionsUs = checkMentionsUs(html);
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, platform }, 'Social verification fetch failed');
      }
    } else if (platform === 'moltbook') {
      // Fetch post from Moltbook public API
      try {
        const url = new URL(postUrl);
        const parts = url.pathname.split('/').filter(Boolean);
        // Extract post ID from URL: moltbook.com/post/{id} or moltbook.com/submolts/{name}/posts/{id}
        let postId: string | null = null;
        if (parts.length >= 2 && parts[0] === 'post') {
          postId = parts[1];
        } else if (parts.length >= 4 && parts[0] === 'submolts' && parts[2] === 'posts') {
          postId = parts[3];
        } else {
          // Try last segment as post ID
          postId = parts[parts.length - 1];
        }

        if (postId) {
          const apiUrl = `https://www.moltbook.com/api/v1/posts/${postId}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(apiUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'HumanPages/1.0' },
          });
          clearTimeout(timeout);

          if (resp.ok) {
            const data = await resp.json() as { success?: boolean; post?: { title?: string; content?: string } };
            if (data.success && data.post) {
              const content = `${data.post.title || ''} ${data.post.content || ''}`;
              if (content.includes(code)) {
                verified = true;
                mentionsUs = checkMentionsUs(content);
              }
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

    if (!mentionsUs) {
      return res.status(400).json({
        error: 'Missing humanpages mention',
        message: 'Your post must include a link to humanpages.ai or mention @HumanPagesAI. Please update your post and try again.',
      });
    }

    // Determine tier
    const tier = determineTier(followerCount);
    const durationDays = getTierDuration(tier);
    // BASIC: no expiration (null = no expiry, subject to TOS)
    // PRO: time-limited
    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

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

    const accessDesc = durationDays ? `${durationDays}-day access` : 'unlimited access (subject to TOS)';
    res.json({
      status: 'ACTIVE',
      tier,
      platform,
      followerCount,
      expiresAt: expiresAt?.toISOString() ?? null,
      limits: TIER_CONFIG[tier],
      message: `Agent activated! ${tier} tier grants ${accessDesc}.`,
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
        promoUpgradedAt: true,
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
      promoUpgradedAt: agent.promoUpgradedAt,
      abuseScore: agent.abuseScore,
      abuseStrikes: agent.abuseStrikes,
      // x402 pay-per-use pricing (alternative to activation)
      ...(isX402Enabled() ? {
        x402: {
          enabled: true,
          prices: {
            profile_view: `$${X402_PRICES.profile_view}`,
            job_offer: `$${X402_PRICES.job_offer}`,
          },
          description: 'Pay-per-use alternative to activation. Send x-payment header with x402 payment payload.',
        },
      } : {}),
    });
  } catch (error) {
    logger.error({ err: error }, 'Get activation status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /promo-status — public, returns launch promo counter
router.get('/promo-status', async (_req, res) => {
  try {
    if (!LAUNCH_PROMO.enabled) {
      return res.json({ enabled: false, total: 0, claimed: 0, remaining: 0 });
    }

    const claimed = await prisma.agent.count({
      where: { promoUpgradedAt: { not: null } },
    });

    res.json({
      enabled: true,
      total: LAUNCH_PROMO.totalSlots,
      claimed,
      remaining: Math.max(0, LAUNCH_PROMO.totalSlots - claimed),
    });
  } catch (error) {
    logger.error({ err: error }, 'Get promo status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /promo-upgrade — claim free PRO via launch promo
router.post('/promo-upgrade', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const agent = req.agent!;

    if (!LAUNCH_PROMO.enabled) {
      return res.status(400).json({ error: 'Promotion not active', message: 'The launch promotion is not currently active.' });
    }

    if (agent.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Agent not active', message: 'Agent must be ACTIVE (social-activated) before claiming the promo.' });
    }

    if (agent.activationTier !== 'BASIC') {
      return res.status(400).json({ error: 'Not eligible', message: 'Only BASIC tier agents can claim the free PRO upgrade.' });
    }

    // Check if already claimed
    const current = await prisma.agent.findUnique({
      where: { id: agent.id },
      select: { promoUpgradedAt: true },
    });
    if (current?.promoUpgradedAt) {
      return res.status(400).json({ error: 'Already claimed', message: 'You have already claimed the free PRO upgrade.' });
    }

    // Atomic: count + update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.agent.count({
        where: { promoUpgradedAt: { not: null } },
      });

      if (claimed >= LAUNCH_PROMO.totalSlots) {
        return null; // sold out
      }

      const expiresAt = new Date(Date.now() + TIER_CONFIG.PRO.durationDays * 24 * 60 * 60 * 1000);

      return tx.agent.update({
        where: { id: agent.id },
        data: {
          activationTier: 'PRO',
          promoUpgradedAt: new Date(),
          activationExpiresAt: expiresAt,
        },
      });
    });

    if (!result) {
      return res.status(400).json({ error: 'Sold out', message: 'All 100 free PRO slots have been claimed.' });
    }

    logger.info({ agentId: agent.id }, 'Agent claimed free PRO via launch promo');

    res.json({
      status: 'ACTIVE',
      tier: 'PRO',
      promoUpgradedAt: result.promoUpgradedAt?.toISOString(),
      activationExpiresAt: result.activationExpiresAt?.toISOString(),
      limits: TIER_CONFIG.PRO,
      message: 'Congratulations! You have been upgraded to PRO tier for free.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Promo upgrade error');
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

    const feeUsd = parseFloat(process.env.AGENT_ACTIVATION_FEE_USD || '5');
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
