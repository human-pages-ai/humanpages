import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createClient, type Client } from '@libsql/client';
import { prisma } from '../lib/prisma.js';
import { BCRYPT_ROUNDS } from '../lib/bcrypt-rounds.js';
import { logger } from '../lib/logger.js';
import { generateReferralCode } from '../lib/referralCode.js';
import { sendVerificationEmail } from '../lib/email.js';
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// --- Turso client (outreach DB) ---

let tursoClient: Client | null = null;

function getTurso(): Client {
  if (!tursoClient) {
    const url = process.env.TURSO_OUTREACH_URL;
    const token = process.env.TURSO_OUTREACH_TOKEN;
    if (!url || !token) {
      throw new Error('TURSO_OUTREACH_URL and TURSO_OUTREACH_TOKEN must be set');
    }
    tursoClient = createClient({ url, authToken: token });
  }
  return tursoClient;
}

// --- Rate limiters ---

const claimPreviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 req/min per IP
  message: { error: 'Too many requests', message: 'Rate limit: 10 requests per minute. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const claimSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 claims per 15 min per IP
  message: { error: 'Too many requests', message: 'Rate limit: 10 requests per 15 minutes. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// --- Validation ---

const claimSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(100).optional(), // Allow overriding the imported name
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Use and Privacy Policy' }),
  }),
});

// --- Username generator (same logic as auth.ts) ---

async function generateUsername(name: string): Promise<string> {
  const firstName = name.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const base = firstName.length >= 2 ? firstName : 'user';
  for (let i = 0; i < 20; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}_${suffix}`;
    const existing = await prisma.human.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

// --- Helper to fetch listing from Turso ---

interface TursoListing {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  category_main: string | null;
  listing_type: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  claim_status: string;
  claim_expires_at: string | null;
}

async function fetchListingByToken(token: string): Promise<TursoListing | null> {
  const db = getTurso();
  const result = await db.execute({
    sql: `SELECT id, name, description, city, country, lat, lon, category_main, listing_type,
                 website, facebook_url, instagram_url, linkedin_url, twitter_url,
                 claim_status, claim_expires_at
          FROM listings WHERE claim_token = ?`,
    args: [token],
  });
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: r.description ? String(r.description) : null,
    city: r.city ? String(r.city) : null,
    country: r.country ? String(r.country) : null,
    lat: r.lat != null ? Number(r.lat) : null,
    lon: r.lon != null ? Number(r.lon) : null,
    category_main: r.category_main ? String(r.category_main) : null,
    listing_type: r.listing_type ? String(r.listing_type) : null,
    website: r.website ? String(r.website) : null,
    facebook_url: r.facebook_url ? String(r.facebook_url) : null,
    instagram_url: r.instagram_url ? String(r.instagram_url) : null,
    linkedin_url: r.linkedin_url ? String(r.linkedin_url) : null,
    twitter_url: r.twitter_url ? String(r.twitter_url) : null,
    claim_status: String(r.claim_status ?? 'pending'),
    claim_expires_at: r.claim_expires_at ? String(r.claim_expires_at) : null,
  };
}

// --- GET /api/claim/:token — Preview listing ---

router.get('/:token', claimPreviewLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(404).json({ error: 'Invalid claim token' });
    }

    const listing = await fetchListingByToken(token);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.claim_status === 'claimed') {
      return res.status(400).json({ error: 'This listing has already been claimed' });
    }

    if (listing.claim_expires_at && new Date(listing.claim_expires_at) < new Date()) {
      return res.status(410).json({ error: 'This claim link has expired' });
    }

    // Return preview data (safe to show)
    const location = [listing.city, listing.country].filter(Boolean).join(', ');
    res.json({
      name: listing.name,
      description: listing.description?.slice(0, 500) || null,
      location: location || null,
      category: listing.category_main,
      website: listing.website,
      listingType: listing.listing_type,
    });
  } catch (error) {
    logger.error({ err: error }, 'Claim preview error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- POST /api/claim/:token — Claim the listing ---

router.post('/:token', claimSubmitLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(404).json({ error: 'Invalid claim token' });
    }

    const { email, password, name: overrideName, termsAccepted } = claimSchema.parse(req.body);

    // Fetch listing from Turso
    const listing = await fetchListingByToken(token);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.claim_status === 'claimed') {
      return res.status(400).json({ error: 'This listing has already been claimed' });
    }

    if (listing.claim_expires_at && new Date(listing.claim_expires_at) < new Date()) {
      return res.status(410).json({ error: 'This claim link has expired' });
    }

    // Check email not already taken
    const existingUser = await prisma.human.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    // Build Human record from Turso data
    const humanName = overrideName || listing.name;
    const username = await generateUsername(humanName);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const location = [listing.city, listing.country].filter(Boolean).join(', ');

    const human = await prisma.human.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: humanName,
        username,
        referralCode: generateReferralCode(),
        termsAcceptedAt: new Date(),
        utmSource: 'outreach-import',
        utmCampaign: 'claim',
        // Imported data
        bio: listing.description?.slice(0, 500) || undefined,
        location: location || undefined,
        locationLat: listing.lat ?? undefined,
        locationLng: listing.lon ?? undefined,
        websiteUrl: listing.website || undefined,
        facebookUrl: listing.facebook_url || undefined,
        instagramUrl: listing.instagram_url || undefined,
        linkedinUrl: listing.linkedin_url || undefined,
        twitterUrl: listing.twitter_url || undefined,
        workType: listing.listing_type === 'freelancer' ? 'digital' : 'physical',
        hideContact: true,
        emailNotifications: false, // Don't spam until they verify
      },
      select: { id: true, email: true, name: true, username: true },
    });

    // Create Service record if category exists
    if (listing.category_main) {
      try {
        await prisma.service.create({
          data: {
            human: { connect: { id: human.id } },
            category: listing.category_main,
            title: listing.category_main,
            description: '',
          },
        });
      } catch (e) {
        logger.warn({ err: e, humanId: human.id }, 'Failed to create service for claimed profile');
      }
    }

    // Mark as claimed in Turso
    const db = getTurso();
    await db.execute({
      sql: `UPDATE listings SET claim_status = 'claimed', claim_token = NULL WHERE id = ?`,
      args: [listing.id],
    });

    // Issue JWT
    const jwtToken = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Send verification email (async, don't block response)
    const verifyToken = jwt.sign({ userId: human.id, action: 'verify' }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    const verifyUrl = `${process.env.FRONTEND_URL || 'https://humanpages.io'}/verify-email?token=${verifyToken}`;
    sendVerificationEmail(email, verifyUrl).catch((err) =>
      logger.error({ err, humanId: human.id }, 'Failed to send verification email for claimed profile')
    );

    // Track event
    trackServerEvent(human.id, 'user_signed_up_server', {
      method: 'claim',
      utm_source: 'outreach-import',
      utm_campaign: 'claim',
      source_listing_id: listing.id,
    }, req);

    logger.info({ humanId: human.id, listingId: listing.id }, 'Profile claimed successfully');
    res.json({ human, token: jwtToken, isNew: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map((e) => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Claim submit error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
