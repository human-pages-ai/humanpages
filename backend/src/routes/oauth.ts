import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Store pending OAuth state tokens (in production, use Redis with TTL)
const pendingStates = new Map<string, number>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, expiresAt] of pendingStates) {
    if (expiresAt < now) pendingStates.delete(state);
  }
}, 5 * 60 * 1000);

function generateOAuthState(): string {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min expiry
  return state;
}

function consumeOAuthState(state: string): boolean {
  const expiresAt = pendingStates.get(state);
  if (!expiresAt || expiresAt < Date.now()) {
    pendingStates.delete(state!);
    return false;
  }
  pendingStates.delete(state);
  return true;
}

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/auth/google/callback`
);

// Generate JWT token for a user
function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

// Google OAuth - redirect to consent screen
router.get('/google', (req, res) => {
  const state = generateOAuthState();
  const authorizeUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
  });
  res.json({ url: authorizeUrl, state });
});

// Google OAuth - callback handler
router.post('/google/callback', async (req, res) => {
  try {
    const { code, state, referrerId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!state || !consumeOAuthState(state)) {
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    const idToken = tokens.id_token;

    if (!idToken) {
      return res.status(400).json({ error: 'Failed to get ID token' });
    }

    // Verify and decode the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Account linking logic:
    // 1. Check if user exists by Google ID
    let human = await prisma.human.findUnique({ where: { googleId } });
    let isNew = false;

    if (!human) {
      // 2. Check if email matches existing account
      human = await prisma.human.findUnique({ where: { email } });

      if (human) {
        // Link Google to existing account
        human = await prisma.human.update({
          where: { id: human.id },
          data: {
            googleId,
            avatarUrl: human.avatarUrl || picture,
          },
        });
      } else {
        // Validate referrer if provided
        let validReferrerId: string | undefined;
        if (referrerId) {
          const referrer = await prisma.human.findUnique({ where: { id: referrerId } });
          if (referrer) validReferrerId = referrerId;
        }

        // 3. Create new user (no password needed for OAuth-only)
        human = await prisma.human.create({
          data: {
            email,
            name: name || email.split('@')[0],
            googleId,
            avatarUrl: picture,
            contactEmail: email,
            referredBy: validReferrerId,
          },
        });
        isNew = true;
      }
    }

    const token = generateToken(human.id);

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
      isNew,
    });
  } catch (error) {
    logger.error({ err: error }, 'Google OAuth error');
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

// GitHub OAuth - redirect to auth page
router.get('/github', (req, res) => {
  const state = generateOAuthState();
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.FRONTEND_URL}/auth/github/callback`,
    scope: 'read:user user:email',
    state,
  });

  res.json({ url: `https://github.com/login/oauth/authorize?${params}`, state });
});

// GitHub OAuth - callback handler
router.post('/github/callback', async (req, res) => {
  try {
    const { code, state, referrerId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!state || !consumeOAuthState(state)) {
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as { error?: string; error_description?: string; access_token?: string };

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || 'Failed to get access token' });
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json() as { id: number; avatar_url: string; name?: string; login: string };
    const githubId = String(userData.id);
    const avatarUrl = userData.avatar_url;
    const name = userData.name || userData.login;

    // Get primary email from GitHub
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean }>;
    const primaryEmail = emails.find((e) => e.primary)?.email || emails[0]?.email;

    if (!primaryEmail) {
      return res.status(400).json({ error: 'Could not get email from GitHub' });
    }

    // Account linking logic:
    // 1. Check if user exists by GitHub ID
    let human = await prisma.human.findUnique({ where: { githubId } });
    let isNew = false;

    if (!human) {
      // 2. Check if email matches existing account
      human = await prisma.human.findUnique({ where: { email: primaryEmail } });

      if (human) {
        // Link GitHub to existing account
        human = await prisma.human.update({
          where: { id: human.id },
          data: {
            githubId,
            avatarUrl: human.avatarUrl || avatarUrl,
          },
        });
      } else {
        // Validate referrer if provided
        let validReferrerId: string | undefined;
        if (referrerId) {
          const referrer = await prisma.human.findUnique({ where: { id: referrerId } });
          if (referrer) validReferrerId = referrerId;
        }

        // 3. Create new user (no password needed for OAuth-only)
        human = await prisma.human.create({
          data: {
            email: primaryEmail,
            name,
            githubId,
            avatarUrl,
            contactEmail: primaryEmail,
            referredBy: validReferrerId,
          },
        });
        isNew = true;
      }
    }

    const token = generateToken(human.id);

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
      isNew,
    });
  } catch (error) {
    logger.error({ err: error }, 'GitHub OAuth error');
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

export default router;
