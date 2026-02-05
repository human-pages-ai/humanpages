import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';

const router = Router();

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
  const authorizeUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
  });
  res.json({ url: authorizeUrl });
});

// Google OAuth - callback handler
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
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
        // 3. Create new user (no password needed for OAuth-only)
        human = await prisma.human.create({
          data: {
            email,
            name: name || email.split('@')[0],
            googleId,
            avatarUrl: picture,
            contactEmail: email,
          },
        });
      }
    }

    const token = generateToken(human.id);

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

// GitHub OAuth - redirect to auth page
router.get('/github', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.FRONTEND_URL}/auth/github/callback`,
    scope: 'read:user user:email',
  });

  res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
});

// GitHub OAuth - callback handler
router.post('/github/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
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

    const tokenData = await tokenResponse.json();

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

    const userData = await userResponse.json();
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

    const emails = await emailsResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

    if (!primaryEmail) {
      return res.status(400).json({ error: 'Could not get email from GitHub' });
    }

    // Account linking logic:
    // 1. Check if user exists by GitHub ID
    let human = await prisma.human.findUnique({ where: { githubId } });

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
        // 3. Create new user (no password needed for OAuth-only)
        human = await prisma.human.create({
          data: {
            email: primaryEmail,
            name,
            githubId,
            avatarUrl,
            contactEmail: primaryEmail,
          },
        });
      }
    }

    const token = generateToken(human.id);

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

export default router;
