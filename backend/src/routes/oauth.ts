import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Clean up expired OAuth states every 5 minutes
setInterval(async () => {
  try {
    await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (err) {
    logger.error({ err }, 'Failed to clean up expired OAuth states');
  }
}, 5 * 60 * 1000);

async function generateOAuthState(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.oAuthState.create({
    data: {
      token,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
    },
  });
  return token;
}

async function consumeOAuthState(state: string): Promise<boolean> {
  try {
    const record = await prisma.oAuthState.delete({ where: { token: state } });
    return record.expiresAt > new Date();
  } catch {
    // delete throws if not found — means invalid/already consumed
    return false;
  }
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
router.get('/google', async (req, res) => {
  const state = await generateOAuthState();
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
    const { code, state, referrerId, termsAccepted } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Only consume state when we're actually going to complete the flow
    // First, verify the state is valid without consuming it
    const stateRecord = await prisma.oAuthState.findUnique({ where: { token: state } });
    if (!stateRecord || stateRecord.expiresAt <= new Date()) {
      // Clean up expired state if it exists
      if (stateRecord) {
        await prisma.oAuthState.delete({ where: { token: state } }).catch(() => {});
      }
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
        // Link Google to existing account - consume state
        await consumeOAuthState(state);
        human = await prisma.human.update({
          where: { id: human.id },
          data: {
            googleId,
            avatarUrl: human.avatarUrl || picture,
          },
        });
      } else {
        // New user - require terms acceptance before creating account
        if (!termsAccepted) {
          return res.json({ requiresTerms: true, provider: 'google' });
        }

        // Consume state now that terms are accepted
        await consumeOAuthState(state);

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
            termsAcceptedAt: new Date(),
            emailVerified: true, // OAuth email is verified by provider
          },
        });
        isNew = true;
      }
    } else {
      // Existing user by Google ID - consume state
      await consumeOAuthState(state);
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
router.get('/github', async (req, res) => {
  const state = await generateOAuthState();
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
    const { code, state, referrerId, termsAccepted } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Verify state without consuming it yet
    const stateRecord = await prisma.oAuthState.findUnique({ where: { token: state } });
    if (!stateRecord || stateRecord.expiresAt <= new Date()) {
      if (stateRecord) {
        await prisma.oAuthState.delete({ where: { token: state } }).catch(() => {});
      }
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
        // Link GitHub to existing account - consume state
        await consumeOAuthState(state);
        human = await prisma.human.update({
          where: { id: human.id },
          data: {
            githubId,
            avatarUrl: human.avatarUrl || avatarUrl,
          },
        });
      } else {
        // New user - require terms acceptance
        if (!termsAccepted) {
          return res.json({ requiresTerms: true, provider: 'github' });
        }

        // Consume state now that terms are accepted
        await consumeOAuthState(state);

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
            termsAcceptedAt: new Date(),
            emailVerified: true, // OAuth email is verified by provider
          },
        });
        isNew = true;
      }
    } else {
      // Existing user by GitHub ID - consume state
      await consumeOAuthState(state);
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
