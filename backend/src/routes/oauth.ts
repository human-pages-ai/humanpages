import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';

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
            name,
            googleId,
            avatarUrl: picture,
            contactEmail: email,
            referredBy: validReferrerId,
            termsAcceptedAt: new Date(),
            emailVerified: true, // OAuth email is verified by provider
          },
        });
        isNew = true;

        // Track OAuth signup in PostHog
        trackServerEvent(human.id, 'user_signed_up_server', { method: 'google' });
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

export default router;
