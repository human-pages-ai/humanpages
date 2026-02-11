import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { generateReferralCode } from '../lib/referralCode.js';

const router = Router();

// Clean up expired OAuth states every 5 minutes
setInterval(async () => {
  try {
    await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (err) {
    logger.error({ err }, 'Failed to clean up expired OAuth states');
  }
}, 5 * 60 * 1000);

// Clean up stale email verification tokens every hour
// Tokens older than 24 hours for unverified accounts are cleared
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await prisma.human.updateMany({
      where: {
        emailVerified: false,
        emailVerificationToken: { not: null },
        createdAt: { lt: cutoff },
      },
      data: { emailVerificationToken: null },
    });
    if (count > 0) {
      logger.info({ count }, 'Cleared stale email verification tokens');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to clean up stale email verification tokens');
  }
}, 60 * 60 * 1000);

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

// Cache Google profile info between the requiresTerms round-trip.
// Key: OAuth state token → Google profile. Entries expire with the state (10 min).
const pendingOAuthProfiles = new Map<string, { googleId: string; email: string; name: string; picture?: string }>();

// Google OAuth - callback handler
router.post('/google/callback', async (req, res) => {
  try {
    const { code, state, referrerId, termsAccepted } = req.body;

    if (!code && !termsAccepted) {
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
      pendingOAuthProfiles.delete(state);
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    // Resolve Google profile: either from cache (terms retry) or by exchanging the code
    let googleId: string;
    let email: string;
    let name: string;
    let picture: string | undefined;

    const cached = pendingOAuthProfiles.get(state);
    if (cached) {
      // Second call after termsAccepted — code was already exchanged
      ({ googleId, email, name, picture } = cached);
    } else {
      // First call — exchange the authorization code for tokens
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

      googleId = payload.sub!;
      email = payload.email;
      name = payload.name || email.split('@')[0];
      picture = payload.picture;
    }

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
        pendingOAuthProfiles.delete(state);
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
          // Cache the profile so we don't need the code again
          pendingOAuthProfiles.set(state, { googleId, email, name, picture });
          return res.json({ requiresTerms: true, provider: 'google' });
        }

        // Consume state now that terms are accepted
        await consumeOAuthState(state);
        pendingOAuthProfiles.delete(state);

        // Validate referrer if provided (accepts referralCode or legacy id)
        let validReferrerId: string | undefined;
        if (referrerId) {
          const referrer = await prisma.human.findUnique({ where: { referralCode: referrerId } })
            ?? await prisma.human.findUnique({ where: { id: referrerId } });
          if (referrer) validReferrerId = referrer.id;
        }

        // 3. Create new user (no password needed for OAuth-only)
        human = await prisma.human.create({
          data: {
            email,
            name,
            googleId,
            avatarUrl: picture,
            contactEmail: email,
            referredBy: validReferrerId,
            referralCode: generateReferralCode(),
            termsAcceptedAt: new Date(),
            emailVerified: true, // OAuth email is verified by provider
          },
        });
        isNew = true;

        // Track OAuth signup in PostHog (pass req for country geolocation)
        trackServerEvent(human.id, 'user_signed_up_server', { method: 'google' }, req);
      }
    } else {
      // Existing user by Google ID - consume state
      await consumeOAuthState(state);
      pendingOAuthProfiles.delete(state);
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

// =========================================================================
// LinkedIn OAuth (OIDC) — Login/Signup + Credibility Verification
// =========================================================================

interface LinkedInProfile {
  linkedinId: string;
  email: string;
  name: string;
  picture?: string;
}

async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<LinkedInProfile> {
  // Exchange authorization code for access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => 'Unknown error');
    logger.error({ status: tokenRes.status, body: errText }, 'LinkedIn token exchange failed');
    throw new Error('Failed to exchange LinkedIn authorization code');
  }

  const tokenData = await tokenRes.json() as { access_token: string };

  // Fetch userinfo from OIDC endpoint
  const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error('Failed to fetch LinkedIn user info');
  }

  const userInfo = await userInfoRes.json() as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!userInfo.sub || !userInfo.email) {
    throw new Error('LinkedIn profile missing required fields');
  }

  return {
    linkedinId: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name || userInfo.email.split('@')[0],
    picture: userInfo.picture,
  };
}

function getLinkedInRedirectUri(purpose: 'login' | 'verify'): string {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return purpose === 'login'
    ? `${base}/auth/linkedin/callback`
    : `${base}/auth/linkedin-verify/callback`;
}

function buildLinkedInAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile email',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

// LinkedIn OAuth - redirect to consent screen (login flow)
router.get('/linkedin', async (req, res) => {
  const state = await generateOAuthState();
  const redirectUri = getLinkedInRedirectUri('login');
  const url = buildLinkedInAuthUrl(state, redirectUri);
  res.json({ url, state });
});

// Cache LinkedIn profile info between the requiresTerms round-trip
const pendingLinkedInProfiles = new Map<string, LinkedInProfile>();

// LinkedIn OAuth - callback handler (login/signup)
router.post('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, referrerId, termsAccepted } = req.body;

    if (!code && !termsAccepted) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Verify state is valid without consuming it
    const stateRecord = await prisma.oAuthState.findUnique({ where: { token: state } });
    if (!stateRecord || stateRecord.expiresAt <= new Date()) {
      if (stateRecord) {
        await prisma.oAuthState.delete({ where: { token: state } }).catch(() => {});
      }
      pendingLinkedInProfiles.delete(state);
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    // Resolve LinkedIn profile: either from cache (terms retry) or by exchanging the code
    let profile: LinkedInProfile;

    const cached = pendingLinkedInProfiles.get(state);
    if (cached) {
      profile = cached;
    } else {
      const redirectUri = getLinkedInRedirectUri('login');
      profile = await exchangeLinkedInCode(code, redirectUri);
    }

    // Account linking logic (mirrors Google exactly)
    let human = await prisma.human.findUnique({ where: { linkedinId: profile.linkedinId } });
    let isNew = false;

    if (!human) {
      human = await prisma.human.findUnique({ where: { email: profile.email } });

      if (human) {
        // Link LinkedIn to existing account
        await consumeOAuthState(state);
        pendingLinkedInProfiles.delete(state);
        human = await prisma.human.update({
          where: { id: human.id },
          data: {
            linkedinId: profile.linkedinId,
            avatarUrl: human.avatarUrl || profile.picture,
          },
        });
      } else {
        // New user - require terms acceptance
        if (!termsAccepted) {
          pendingLinkedInProfiles.set(state, profile);
          return res.json({ requiresTerms: true, provider: 'linkedin' });
        }

        await consumeOAuthState(state);
        pendingLinkedInProfiles.delete(state);

        let validReferrerId: string | undefined;
        if (referrerId) {
          const referrer = await prisma.human.findUnique({ where: { referralCode: referrerId } })
            ?? await prisma.human.findUnique({ where: { id: referrerId } });
          if (referrer) validReferrerId = referrer.id;
        }

        human = await prisma.human.create({
          data: {
            email: profile.email,
            name: profile.name,
            linkedinId: profile.linkedinId,
            avatarUrl: profile.picture,
            contactEmail: profile.email,
            referredBy: validReferrerId,
            referralCode: generateReferralCode(),
            termsAcceptedAt: new Date(),
            emailVerified: true,
          },
        });
        isNew = true;

        trackServerEvent(human.id, 'user_signed_up_server', { method: 'linkedin' }, req);
      }
    } else {
      await consumeOAuthState(state);
      pendingLinkedInProfiles.delete(state);
    }

    const token = generateToken(human.id);

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
      isNew,
    });
  } catch (error) {
    logger.error({ err: error }, 'LinkedIn OAuth error');
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

// LinkedIn Credibility Verification - get auth URL (requires login)
router.get('/linkedin/verify', authenticateToken, async (req: AuthRequest, res) => {
  const state = await generateOAuthState();
  const redirectUri = getLinkedInRedirectUri('verify');
  const url = buildLinkedInAuthUrl(state, redirectUri);
  res.json({ url, state });
});

// LinkedIn Credibility Verification - callback (requires login)
router.post('/linkedin/verify/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ error: 'Code and state required' });
    }

    const validState = await consumeOAuthState(state);
    if (!validState) {
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    const redirectUri = getLinkedInRedirectUri('verify');
    const profile = await exchangeLinkedInCode(code, redirectUri);

    // Check if this LinkedIn ID is already linked to another user
    const existingUser = await prisma.human.findUnique({ where: { linkedinId: profile.linkedinId } });
    if (existingUser && existingUser.id !== req.userId) {
      return res.status(409).json({ error: 'This LinkedIn account is already linked to another user' });
    }

    // Update current user: set linkedinId, linkedinVerified, and always overwrite linkedinUrl
    // to prevent set-fake-URL → verify-real-account → badge-on-fake-URL attack
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        linkedinId: profile.linkedinId,
        linkedinVerified: true,
        linkedinUrl: `https://www.linkedin.com/in/${profile.linkedinId}`,
      },
    });

    logger.info({ userId: req.userId }, 'LinkedIn credibility verified');

    res.json({ linkedinVerified: true });
  } catch (error) {
    logger.error({ err: error }, 'LinkedIn verify error');
    res.status(500).json({ error: 'LinkedIn verification failed' });
  }
});

// =========================================================================
// GitHub OAuth — Credibility Verification (not login — verify only)
// =========================================================================

function getGitHubRedirectUri(): string {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/auth/github-verify/callback`;
}

function buildGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: getGitHubRedirectUri(),
    state,
    scope: 'read:user',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

// GitHub Verification - get auth URL (requires login)
router.get('/github/verify', authenticateToken, async (req: AuthRequest, res) => {
  const state = await generateOAuthState();
  const url = buildGitHubAuthUrl(state);
  res.json({ url, state });
});

// GitHub Verification - callback (requires login)
router.post('/github/verify/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ error: 'Code and state required' });
    }

    const validState = await consumeOAuthState(state);
    if (!validState) {
      return res.status(403).json({ error: 'Invalid or expired OAuth state' });
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: getGitHubRedirectUri(),
      }),
    });

    if (!tokenRes.ok) {
      logger.error({ status: tokenRes.status }, 'GitHub token exchange failed');
      throw new Error('Failed to exchange GitHub authorization code');
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      logger.error({ error: tokenData.error }, 'GitHub token error');
      throw new Error('GitHub token exchange returned error');
    }

    // Fetch user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch GitHub user info');
    }

    const githubUser = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string;
      avatar_url?: string;
    };

    const githubId = String(githubUser.id);

    // Check if this GitHub ID is already linked to another user
    const existingUser = await prisma.human.findUnique({ where: { githubId } });
    if (existingUser && existingUser.id !== req.userId) {
      return res.status(409).json({ error: 'This GitHub account is already linked to another user' });
    }

    // Update current user: always overwrite githubUrl to prevent URL spoofing
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        githubId,
        githubVerified: true,
        githubUsername: githubUser.login,
        githubUrl: `https://github.com/${githubUser.login}`,
      },
    });

    logger.info({ userId: req.userId, githubUsername: githubUser.login }, 'GitHub credibility verified');

    res.json({ githubVerified: true, githubUsername: githubUser.login });
  } catch (error) {
    logger.error({ err: error }, 'GitHub verify error');
    res.status(500).json({ error: 'GitHub verification failed' });
  }
});

export default router;
