import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { isDisposableEmail } from '../lib/disposableEmails.js';
import { sendEmailWithOutbox } from '../lib/email.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://humanpages.ai';

// ─── Rate Limiting ───────────────────────────────────────────────

const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many verification attempts. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
  skip: () => process.env.NODE_ENV === 'test',
});

// ─── Schemas ─────────────────────────────────────────────────────

const emailRequestSchema = z.object({
  email: z.string().email().max(254),
});

const emailVerifySchema = z.object({
  token: z.string().min(1),
});

const githubCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const telegramSchema = z.object({
  telegramUsername: z.string().min(1).max(100),
});

// ─── Helper: mark agent as solver-verified ───────────────────────

async function markSolverVerified(agentId: string, method: string, extra?: Record<string, string>): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      solverVerified: true,
      solverVerifiedAt: new Date(),
      solverVerifiedMethod: method,
      ...(extra || {}),
    },
  });
}

// ─── Helper: check for reuse of verification identity ────────────

async function isGithubIdUsed(githubId: string, excludeAgentId: string): Promise<boolean> {
  const existing = await prisma.agent.findFirst({
    where: {
      solverGithubId: githubId,
      solverVerified: true,
      id: { not: excludeAgentId },
    },
    select: { id: true },
  });
  return !!existing;
}

async function isTelegramIdUsed(telegramId: string, excludeAgentId: string): Promise<boolean> {
  const existing = await prisma.agent.findFirst({
    where: {
      solverTelegramId: telegramId,
      solverVerified: true,
      id: { not: excludeAgentId },
    },
    select: { id: true },
  });
  return !!existing;
}

// ─── GET /status — check solver verification status ──────────────

router.get('/status', authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const agent = req.agent!;
  const full = await prisma.agent.findUnique({
    where: { id: agent.id },
    select: {
      solverVerified: true,
      solverVerifiedAt: true,
      solverVerifiedMethod: true,
    },
  });
  return res.json({
    solverVerified: full?.solverVerified ?? false,
    verifiedAt: full?.solverVerifiedAt ?? null,
    method: full?.solverVerifiedMethod ?? null,
  });
});

// ─── POST /email/send — send verification email ─────────────────

router.post('/email/send', verifyLimiter, authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const agent = req.agent!;

  if (agent.solverVerified) {
    return res.status(400).json({ error: 'Already verified' });
  }

  const parsed = emailRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const { email } = parsed.data;

  // Block disposable emails
  if (isDisposableEmail(email)) {
    return res.status(400).json({
      error: 'Disposable email addresses are not accepted. Please use a permanent email.',
    });
  }

  // Check if this email is already used for solver verification by another agent
  const existingWithEmail = await prisma.agent.findFirst({
    where: {
      contactEmail: email,
      solverVerified: true,
      solverVerifiedMethod: 'email',
      id: { not: agent.id },
    },
    select: { id: true },
  });
  if (existingWithEmail) {
    return res.status(400).json({ error: 'This email is already used for another agent\'s solver verification' });
  }

  // Generate verification token (JWT with 1 hour expiry)
  const token = jwt.sign(
    { agentId: agent.id, email, purpose: 'solver-email-verify' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );

  // Store token on agent
  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      solverVerificationToken: token,
      contactEmail: email, // also save the email
    },
  });

  // Send verification email
  const verifyUrl = `${FRONTEND_URL}/solver/verify-email?token=${token}`;

  const sent = await sendEmailWithOutbox({
    to: email,
    subject: 'Verify your email for Moltbook Solver access',
    text: `Click here to verify your email and unlock Moltbook Solver access:\n\n${verifyUrl}\n\nThis link expires in 1 hour.\n\n— HumanPages`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          Click the button below to verify your email and unlock Moltbook Solver access (50 free solves/day).
        </p>
        <a href="${verifyUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Verify Email
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
        <p style="color: #94a3b8; font-size: 12px;">— <a href="https://humanpages.ai" style="color: #f97316;">HumanPages</a></p>
      </div>
    `,
    _meta: { type: 'solver-verification' },
  });

  if (!sent) {
    logger.error({ agentId: agent.id, email }, 'Failed to send solver verification email');
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }

  return res.json({ message: 'Verification email sent. Check your inbox.' });
});

// ─── POST /email/verify — verify email token ────────────────────

router.post('/email/verify', verifyLimiter, async (req, res: Response) => {
  const parsed = emailVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const payload = jwt.verify(parsed.data.token, process.env.JWT_SECRET!) as {
      agentId: string;
      email: string;
      purpose: string;
    };

    if (payload.purpose !== 'solver-email-verify') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Verify token matches what's stored
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: { id: true, solverVerified: true, solverVerificationToken: true },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.solverVerified) {
      return res.json({ message: 'Already verified', solverVerified: true });
    }

    if (agent.solverVerificationToken !== parsed.data.token) {
      return res.status(400).json({ error: 'Token expired or already used. Request a new one.' });
    }

    await markSolverVerified(payload.agentId, 'email');

    logger.info({ agentId: payload.agentId, email: payload.email }, 'Solver access verified via email');

    return res.json({ message: 'Email verified! Solver access unlocked.', solverVerified: true });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Token expired. Request a new verification email.' });
    }
    return res.status(400).json({ error: 'Invalid token' });
  }
});

// ─── GET /github/auth — get GitHub OAuth URL ─────────────────────

router.get('/github/auth', authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const agent = req.agent!;

  if (agent.solverVerified) {
    return res.status(400).json({ error: 'Already verified' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  // Generate state token (includes agent ID for callback)
  const state = jwt.sign(
    { agentId: agent.id, purpose: 'solver-github-verify' },
    process.env.JWT_SECRET!,
    { expiresIn: '10m' },
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${FRONTEND_URL}/solver/github-callback`,
    state,
    scope: 'read:user',
  });

  return res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
});

// ─── POST /github/callback — exchange code and verify ────────────

router.post('/github/callback', verifyLimiter, async (req, res: Response) => {
  const parsed = githubCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Code and state required' });
  }

  const { code, state } = parsed.data;

  // Verify state
  let statePayload: { agentId: string; purpose: string };
  try {
    statePayload = jwt.verify(state, process.env.JWT_SECRET!) as typeof statePayload;
    if (statePayload.purpose !== 'solver-github-verify') {
      return res.status(400).json({ error: 'Invalid state' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid or expired state. Try again.' });
  }

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${FRONTEND_URL}/solver/github-callback`,
    }),
  });

  if (!tokenRes.ok) {
    return res.status(500).json({ error: 'GitHub token exchange failed' });
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (tokenData.error || !tokenData.access_token) {
    return res.status(400).json({ error: 'GitHub authorization failed. Try again.' });
  }

  // Fetch GitHub user
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userRes.ok) {
    return res.status(500).json({ error: 'Failed to fetch GitHub profile' });
  }

  const githubUser = (await userRes.json()) as {
    id: number;
    login: string;
    created_at: string;
    public_repos: number;
  };

  const githubId = String(githubUser.id);

  // Check for reuse
  if (await isGithubIdUsed(githubId, statePayload.agentId)) {
    return res.status(400).json({
      error: 'This GitHub account is already used for another agent\'s solver verification',
    });
  }

  // Check agent exists and isn't already verified
  const agent = await prisma.agent.findUnique({
    where: { id: statePayload.agentId },
    select: { id: true, solverVerified: true },
  });

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  if (agent.solverVerified) {
    return res.json({ message: 'Already verified', solverVerified: true });
  }

  await markSolverVerified(statePayload.agentId, 'github', { solverGithubId: githubId });

  logger.info(
    { agentId: statePayload.agentId, githubLogin: githubUser.login, githubId },
    'Solver access verified via GitHub',
  );

  return res.json({
    message: `GitHub verified (${githubUser.login})! Solver access unlocked.`,
    solverVerified: true,
  });
});

// ─── POST /telegram/verify — verify via Telegram bot ─────────────
// Agent provides their TG username, we check if our bot has received
// a /verify command from that user with their agent ID.

router.post('/telegram/send', verifyLimiter, authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const agent = req.agent!;

  if (agent.solverVerified) {
    return res.status(400).json({ error: 'Already verified' });
  }

  // Generate a 6-char verification code
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();

  await prisma.agent.update({
    where: { id: agent.id },
    data: { solverVerificationToken: `tg:${code}` },
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'HumanPagesBot';

  return res.json({
    message: `Send this code to @${botUsername} on Telegram to verify`,
    code,
    botUsername,
    deepLink: `https://t.me/${botUsername}?start=solver_${agent.id}_${code}`,
  });
});

// Called by the Telegram bot webhook when it receives the verification code
router.post('/telegram/confirm', async (req, res: Response) => {
  // This endpoint is called internally by the TG bot handler
  const botSecret = req.headers['x-bot-secret'] as string;
  if (botSecret !== process.env.TELEGRAM_BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { agentId, telegramId, telegramUsername } = req.body;
  if (!agentId || !telegramId) {
    return res.status(400).json({ error: 'agentId and telegramId required' });
  }

  // Check for reuse
  if (await isTelegramIdUsed(String(telegramId), agentId)) {
    return res.status(400).json({ error: 'This Telegram account is already used for another agent' });
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, solverVerified: true },
  });

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  if (agent.solverVerified) {
    return res.json({ message: 'Already verified', solverVerified: true });
  }

  await markSolverVerified(agentId, 'telegram', { solverTelegramId: String(telegramId) });

  logger.info(
    { agentId, telegramId, telegramUsername },
    'Solver access verified via Telegram',
  );

  return res.json({ message: 'Verified!', solverVerified: true });
});

// ─── POST /wallet/verify — verify via existing wallet signature ──
// If agent already has a verified wallet (EIP-191), unlock solver.

router.post('/wallet/verify', authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const agent = req.agent!;

  if (agent.solverVerified) {
    return res.status(400).json({ error: 'Already verified' });
  }

  // Check if agent has any verified wallet
  const verifiedWallet = await prisma.agentWallet.findFirst({
    where: {
      agentId: agent.id,
      verified: true,
    },
    select: { address: true },
  });

  if (!verifiedWallet) {
    return res.status(400).json({
      error: 'No verified wallet found. First verify a wallet via PATCH /api/agents/:id/wallet, then call this endpoint.',
    });
  }

  await markSolverVerified(agent.id, 'wallet');

  logger.info(
    { agentId: agent.id, walletAddress: verifiedWallet.address },
    'Solver access verified via wallet',
  );

  return res.json({
    message: `Wallet verified (${verifiedWallet.address.slice(0, 6)}...${verifiedWallet.address.slice(-4)})! Solver access unlocked.`,
    solverVerified: true,
  });
});

export default router;
