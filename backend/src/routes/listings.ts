import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { requireActiveAgent } from '../middleware/requireActiveAgent.js';
import { x402PaymentCheck, X402Request } from '../middleware/x402PaymentCheck.js';
import { requireActiveOrPaid } from '../middleware/requireActiveOrPaid.js';
import { isX402Enabled, X402_PRICES, buildPaymentRequiredResponse } from '../lib/x402.js';
import { calculateDistance, boundingBox, DEFAULT_SEARCH_RADIUS_KM } from '../lib/geo.js';
import { geocodeLocation } from '../lib/geocode.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { createOpenAIClient } from '../lib/openai-keys.js';
import { isAllowedUrl, deliverWebhook } from '../lib/webhook.js';
import { sendJobOfferEmail, sendListingTermsChangedEmail } from '../lib/email.js';
import { processProfileImage, uploadProfilePhoto, getProfilePhotoSignedUrl, deleteProfilePhoto, downloadExternalImage } from '../lib/storage.js';
import { queueModeration, moderateText } from '../lib/moderation.js';
import { generateListingCover } from '../lib/listingCovers.js';
import sharp from 'sharp';

const router = Router();

// ─── Short link code generation ──────────────────────────────────────────────
// Alphabet: lowercase a-z + 2-9, excluding confusing chars (0, o, 1, l, i)
const LINK_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 32 chars
const LINK_CODE_LENGTH = 6;

function generateLinkCode(): string {
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_ALPHABET[Math.floor(Math.random() * LINK_ALPHABET.length)];
  }
  return code;
}

/** Create 10 ListingLink rows for a newly created listing. Retries on code collision. */
async function createListingLinks(listingId: string): Promise<void> {
  const labels = [
    'default',
    'campaign-2', 'campaign-3', 'campaign-4', 'campaign-5',
    'campaign-6', 'campaign-7', 'campaign-8', 'campaign-9', 'campaign-10',
  ];

  for (const label of labels) {
    let attempts = 0;
    while (attempts < 5) {
      try {
        await prisma.listingLink.create({
          data: {
            code: generateLinkCode(),
            listingId,
            label,
          },
        });
        break;
      } catch (err: any) {
        // Unique constraint violation on code — retry with a new code
        if (err?.code === 'P2002') {
          attempts++;
          continue;
        }
        throw err;
      }
    }
  }
}

// Material fields — these are the listing terms that applicants rely on.
// Changes to these fields trigger the reconfirm flow for existing applicants.
const MATERIAL_FIELDS = [
  'title', 'description', 'budgetUsdc', 'budgetFlexible',
  'workMode', 'location', 'locationLat', 'locationLng', 'radiusKm',
] as const;

/** Build a snapshot of material listing fields (for storing on applications). */
function buildListingSnapshot(listing: {
  title: string; description: string; budgetUsdc: any;
  budgetFlexible: boolean; workMode: string | null;
  location: string | null; locationLat: number | null;
  locationLng: number | null; radiusKm: number | null;
}) {
  return {
    title: listing.title,
    description: listing.description,
    budgetUsdc: listing.budgetUsdc.toString(),
    budgetFlexible: listing.budgetFlexible,
    workMode: listing.workMode,
    location: listing.location,
    locationLat: listing.locationLat,
    locationLng: listing.locationLng,
    radiusKm: listing.radiusKm,
  };
}

// Rate limiter for public listing browsing: 30/min
const browseRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Limit: 30 per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Rate limiter for applications: 20/hour
const applyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many applications. Limit: 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Rate limiter for listing updates: 10/hour per agent
const updateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.agent?.id || 'unknown',
  message: { error: 'Too many listing updates. Limit: 10 per hour.' },
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Multer: memory storage, 2MB limit, images only
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Tier-based listing limits with per-tier windows
const TIER_LISTING_CONFIG: Record<string, { limit: number; windowMs: number }> = {
  BASIC: { limit: 1, windowMs: 7 * 24 * 60 * 60 * 1000 }, // 1 per 7 days
  PRO:   { limit: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per day
  WHALE: { limit: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per day
};

// Schema for creating a listing
const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().max(100).optional(),
  budgetUsdc: z.number().min(5, 'Minimum budget is $5'),
  budgetFlexible: z.boolean().optional().default(false),
  requiredSkills: z.array(z.string().max(100)).max(30).default([]),
  requiredEquipment: z.array(z.string().max(100)).max(30).default([]),
  location: z.string().optional(),
  locationStreet: z.string().max(500).optional(),
  locationCountry: z.string().max(2).optional(),
  locationRegion: z.string().max(200).optional(),
  locationLocality: z.string().max(200).optional(),
  locationPostal: z.string().max(20).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().int().min(1).optional(),
  workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  expiresAt: z.string().refine((val) => {
    const date = new Date(val);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return date > now && date <= maxDate;
  }, 'expiresAt must be in the future and within 90 days'),
  maxApplicants: z.number().int().min(1).max(10000).optional(),
  callbackUrl: z.string().url().optional(),
  callbackSecret: z.string().min(16).max(256).optional(),
});

// Schema for applying to a listing
const applySchema = z.object({
  pitch: z.string().max(500).optional().default(''),
});

// Schema for updating an application (pitch / cover letter)
const updateApplicationSchema = z.object({
  pitch: z.string().min(1).max(500),
});

// Schema for making an offer
const makeOfferSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge this is a binding commitment by setting confirm: true' }),
  }),
});

// POST / - Create a listing
router.post('/', x402PaymentCheck('listing_post'), authenticateAgent, requireActiveOrPaid, async (req: X402Request, res) => {
  try {
    const data = createListingSchema.parse(req.body);
    const agent = req.agent!;

    // SSRF prevention: validate callback URL
    if (data.callbackUrl && !(await isAllowedUrl(data.callbackUrl))) {
      return res.status(400).json({
        error: 'Invalid callback URL',
        message: 'Callback URL must be a public HTTP(S) endpoint',
      });
    }

    // Tier-based rate limit - skipped for x402 paid requests
    const config = TIER_LISTING_CONFIG[agent.activationTier] || TIER_LISTING_CONFIG.BASIC;
    let recentListingCount = 0;

    if (!req.x402Paid) {
      const windowStart = new Date(Date.now() - config.windowMs);
      recentListingCount = await prisma.listing.count({
        where: {
          agentId: agent.id,
          createdAt: { gte: windowStart },
          status: { not: 'CLOSED' }, // Count all non-closed listings
        },
      });

      if (recentListingCount >= config.limit) {
        const windowDays = config.windowMs / (24 * 60 * 60 * 1000);
        const windowLabel = windowDays >= 7 ? `${windowDays / 7} week${windowDays > 7 ? 's' : ''}` : `${windowDays} day${windowDays > 1 ? 's' : ''}`;
        const tierMsg = `Your ${agent.activationTier} tier allows ${config.limit} listing(s) per ${windowLabel}.`;
        const price = X402_PRICES.listing_post;

        if (isX402Enabled()) {
          const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const paymentRequired = await buildPaymentRequiredResponse('listing_post', resourceUrl);
          res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
          return res.status(402).json({
            ...paymentRequired,
            error: 'Payment required',
            message: `${tierMsg} To proceed, pay $${price} USDC per request via x402, or upgrade to PRO for higher limits.`,
            tier: agent.activationTier,
            limit: config.limit,
            x402: {
              price: `$${price}`,
              currency: 'USDC',
              description: 'Retry this exact request with an X-Payment header to pay per use and bypass the rate limit.',
            },
          });
        }

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `${tierMsg} Upgrade to PRO for higher limits.`,
          tier: agent.activationTier,
          limit: config.limit,
          retryAfter: windowLabel,
        });
      }
    }

    const isPro = agent.activationTier === 'PRO' || agent.activationTier === 'WHALE';

    const listing = await prisma.listing.create({
      data: {
        agentId: agent.id,
        title: data.title,
        description: data.description,
        category: data.category,
        budgetUsdc: new Decimal(data.budgetUsdc),
        budgetFlexible: data.budgetFlexible,
        requiredSkills: data.requiredSkills,
        requiredEquipment: data.requiredEquipment || [],
        location: data.location,
        locationStreet: data.locationStreet,
        locationCountry: data.locationCountry,
        locationRegion: data.locationRegion,
        locationLocality: data.locationLocality,
        locationPostal: data.locationPostal,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        radiusKm: data.radiusKm,
        workMode: data.workMode,
        expiresAt: new Date(data.expiresAt),
        maxApplicants: data.maxApplicants,
        isPro,
        isVerified: agent.isVerified,
        callbackUrl: data.callbackUrl,
        callbackSecret: data.callbackSecret,
        status: 'OPEN',
      },
    });

    // Generate 10 short link codes for this listing
    try {
      await createListingLinks(listing.id);
    } catch (linkErr) {
      logger.warn({ err: linkErr, listingId: listing.id }, 'Failed to generate listing short links');
    }

    // Generate default SVG cover image (free, no moderation needed)
    try {
      const coverBuffer = await generateListingCover(data.title, data.category);
      const coverKey = await uploadProfilePhoto(listing.id, coverBuffer);
      await prisma.listing.update({
        where: { id: listing.id },
        data: { imageKey: coverKey, imageStatus: 'approved' },
      });
    } catch (coverErr) {
      logger.warn({ err: coverErr, listingId: listing.id }, 'Failed to generate default listing cover');
    }

    // Track listing creation
    trackServerEvent(agent.id, 'listing_created', {
      listingId: listing.id,
      budgetUsdc: data.budgetUsdc,
      category: data.category,
      isPro,
    }, req);

    // Log x402 payment if this was a paid request
    if (req.x402Paid && req.x402PaymentPayload) {
      prisma.x402Payment.create({
        data: {
          agentId: agent.id,
          resourceType: 'listing_post',
          resourceId: listing.id,
          amountUsd: X402_PRICES.listing_post,
          network: req.x402MatchedRequirements?.network || 'eip155:8453',
          paymentPayload: req.x402PaymentPayload as any,
          settled: true,
          agentIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
        },
      }).catch((err) => logger.error({ err }, 'Failed to log x402 payment'));
    }

    const windowDays = config.windowMs / (24 * 60 * 60 * 1000);
    const windowLabel = windowDays >= 7 ? `${windowDays / 7} week${windowDays > 7 ? 's' : ''}` : `${windowDays} day${windowDays > 1 ? 's' : ''}`;

    res.status(201).json({
      id: listing.id,
      status: listing.status,
      message: 'Listing created successfully.',
      ...(req.x402Paid ? { paidVia: 'x402' } : {
        rateLimit: {
          remaining: config.limit - recentListingCount - 1,
          resetIn: windowLabel,
          tier: agent.activationTier,
        },
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Create listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / - List open listings (public)
router.get('/', browseRateLimiter, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Build filters
    const where: any = {
      status: 'OPEN',
      expiresAt: { gt: new Date() },
    };

    // Skill filter (comma-separated)
    if (req.query.skill) {
      const skills = (req.query.skill as string).split(',').map(s => s.trim()).filter(Boolean);
      if (skills.length > 0) {
        where.requiredSkills = { hasSome: skills };
      }
    }

    // Category filter
    if (req.query.category) {
      where.category = req.query.category;
    }

    // Work mode filter
    if (req.query.workMode) {
      where.workMode = req.query.workMode;
    }

    // Budget filters
    if (req.query.minBudget) {
      const minBudget = parseFloat(req.query.minBudget as string);
      if (!isNaN(minBudget)) {
        where.budgetUsdc = { ...where.budgetUsdc, gte: new Decimal(minBudget) };
      }
    }
    if (req.query.maxBudget) {
      const maxBudget = parseFloat(req.query.maxBudget as string);
      if (!isNaN(maxBudget)) {
        where.budgetUsdc = { ...where.budgetUsdc, lte: new Decimal(maxBudget) };
      }
    }

    // Location: geocode text → coordinates if lat/lng not provided
    let centerLat: number | undefined;
    let centerLng: number | undefined;
    let searchRadiusKm: number | undefined;
    let resolvedLocation: string | undefined;

    if (req.query.lat && req.query.lng) {
      centerLat = parseFloat(req.query.lat as string);
      centerLng = parseFloat(req.query.lng as string);
      searchRadiusKm = req.query.radius ? parseFloat(req.query.radius as string) : DEFAULT_SEARCH_RADIUS_KM;
    } else if (req.query.location) {
      const geo = await geocodeLocation(req.query.location as string);
      if (geo) {
        centerLat = geo.lat;
        centerLng = geo.lng;
        searchRadiusKm = req.query.radius ? parseFloat(req.query.radius as string) : DEFAULT_SEARCH_RADIUS_KM;
        resolvedLocation = geo.displayName;
      }
    }

    // Apply bounding-box pre-filter when we have coordinates
    if (centerLat != null && centerLng != null && searchRadiusKm &&
        !isNaN(centerLat) && isFinite(centerLat) &&
        !isNaN(centerLng) && isFinite(centerLng) &&
        !isNaN(searchRadiusKm) && isFinite(searchRadiusKm) && searchRadiusKm > 0) {
      const bbox = boundingBox(centerLat, centerLng, searchRadiusKm);
      where.locationLat = { gte: bbox.minLat, lte: bbox.maxLat };
      where.locationLng = { gte: bbox.minLng, lte: bbox.maxLng };
    }

    // Fetch listings
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy: [
          { isVerified: 'desc' }, // Verified agent listings first
          { isPro: 'desc' }, // PRO listings second
          { createdAt: 'desc' },
        ],
        take: limit,
        skip,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              description: true,
              websiteUrl: true,
              domainVerified: true,
              isVerified: true,
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    // Precise Haversine distance filter via raw SQL
    let filteredListings = listings;
    if (centerLat != null && centerLng != null && searchRadiusKm &&
        !isNaN(centerLat) && isFinite(centerLat) &&
        !isNaN(centerLng) && isFinite(centerLng) &&
        !isNaN(searchRadiusKm) && isFinite(searchRadiusKm) && searchRadiusKm > 0 &&
        listings.length > 0) {
      const candidateIds = listings.map(l => l.id);
      const nearbyIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Listing"
        WHERE id = ANY(${candidateIds}::text[])
        AND "locationLat" IS NOT NULL AND "locationLng" IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1.0, cos(radians(${centerLat})) * cos(radians("locationLat"))
            * cos(radians("locationLng") - radians(${centerLng}))
            + sin(radians(${centerLat})) * sin(radians("locationLat")))
          )
        ) <= ${searchRadiusKm}
      `;
      const nearbyIdSet = new Set(nearbyIds.map(r => r.id));
      filteredListings = listings.filter(l => nearbyIdSet.has(l.id));
    }

    // Get agent reputation stats for each listing
    const agentIds = Array.from(new Set(filteredListings.map(l => l.agentId)));
    const agentStats = await Promise.all(
      agentIds.map(async (agentId) => {
        const [completedJobs, reviews, paymentSpeedResult] = await Promise.all([
          prisma.job.count({
            where: {
              registeredAgentId: agentId,
              status: { in: ['PAID', 'STREAMING', 'COMPLETED'] },
            },
          }),
          prisma.review.findMany({
            where: {
              job: { registeredAgentId: agentId },
            },
            select: { rating: true },
          }),
          prisma.$queryRaw<{ avg_hours: number | null }[]>`
            SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "acceptedAt")) / 3600) as avg_hours
            FROM "Job"
            WHERE "registeredAgentId" = ${agentId}
              AND "paidAt" IS NOT NULL
              AND "acceptedAt" IS NOT NULL
          `,
        ]);

        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null;

        const avgPaymentSpeedHours = paymentSpeedResult[0]?.avg_hours
          ? Math.round(paymentSpeedResult[0].avg_hours * 10) / 10
          : null;

        return {
          agentId,
          completedJobs,
          avgRating,
          avgPaymentSpeedHours,
        };
      })
    );

    const agentStatsMap = Object.fromEntries(
      agentStats.map(s => [s.agentId, { completedJobs: s.completedJobs, avgRating: s.avgRating, avgPaymentSpeedHours: s.avgPaymentSpeedHours }])
    );

    // Format response with signed image URLs
    const formattedListings = await Promise.all(
      filteredListings.map(async (listing) => {
        const { callbackSecret, imageKey, ...safeListing } = listing as any;
        let imageUrl: string | null = null;
        if (imageKey && listing.imageStatus === 'approved') {
          imageUrl = await getProfilePhotoSignedUrl(imageKey);
        }
        return {
          ...safeListing,
          imageUrl,
          agentReputation: agentStatsMap[listing.agentId] || { completedJobs: 0, avgRating: null, avgPaymentSpeedHours: null },
        };
      })
    );

    res.json({
      listings: formattedListings,
      pagination: {
        page,
        limit,
        total: centerLat != null ? filteredListings.length : total,
        totalPages: Math.ceil((centerLat != null ? filteredListings.length : total) / limit),
      },
      ...(resolvedLocation ? { resolvedLocation } : {}),
      ...(centerLat != null && centerLng != null && searchRadiusKm ? {
        searchRadius: { lat: centerLat, lng: centerLng, radiusKm: searchRadiusKm },
      } : {}),
    });
  } catch (error) {
    logger.error({ err: error }, 'List listings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /my-applications - Human's applications
router.get('/my-applications', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const applications = await prisma.listingApplication.findMany({
      where: { humanId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            budgetUsdc: true,
            status: true,
            isPro: true,
            agent: {
              select: {
                id: true,
                name: true,
                activationTier: true,
              },
            },
          },
        },
      },
    });

    res.json(applications);
  } catch (error) {
    logger.error({ err: error }, 'Get my applications error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /by-code/:code - Resolve short code to listing ID (public, used by frontend /work/:code route)
router.get('/by-code/:code', async (req, res) => {
  try {
    const link = await prisma.listingLink.findUnique({
      where: { code: req.params.code.toLowerCase() },
      select: { listingId: true, code: true },
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Increment click count (fire-and-forget)
    prisma.listingLink.update({
      where: { code: link.code },
      data: { clicks: { increment: 1 } },
    }).catch((err: unknown) => logger.warn({ err, code: link.code }, 'Failed to increment link click count'));

    res.json({ listingId: link.listingId, code: link.code });
  } catch (error) {
    logger.error({ err: error }, 'Resolve listing link error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - Listing detail
router.get('/:id', async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
            websiteUrl: true,
            domainVerified: true,
            isVerified: true,
            activationTier: true,
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get agent reputation
    const [completedJobs, reviews, paymentSpeedResult] = await Promise.all([
      prisma.job.count({
        where: {
          registeredAgentId: listing.agentId,
          status: { in: ['PAID', 'STREAMING', 'COMPLETED'] },
        },
      }),
      prisma.review.findMany({
        where: {
          job: { registeredAgentId: listing.agentId },
        },
        select: { rating: true },
      }),
      prisma.$queryRaw<{ avg_hours: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "acceptedAt")) / 3600) as avg_hours
        FROM "Job"
        WHERE "registeredAgentId" = ${listing.agentId}
          AND "paidAt" IS NOT NULL
          AND "acceptedAt" IS NOT NULL
      `,
    ]);

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    const avgPaymentSpeedHours = paymentSpeedResult[0]?.avg_hours
      ? Math.round(paymentSpeedResult[0].avg_hours * 10) / 10
      : null;

    // Check if authenticated human has applied
    let hasApplied = false;
    let applicationStatus = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const application = await prisma.listingApplication.findUnique({
          where: {
            listingId_humanId: {
              listingId: listing.id,
              humanId: payload.userId,
            },
          },
          select: { status: true },
        });
        if (application) {
          hasApplied = true;
          applicationStatus = application.status;
        }
      } catch {
        // Invalid token, ignore
      }
    }

    // Strip callbackSecret, resolve image URL
    const { callbackSecret, imageKey, ...safeListing } = listing as any;
    let imageUrl: string | null = null;
    if (imageKey && listing.imageStatus === 'approved') {
      imageUrl = await getProfilePhotoSignedUrl(imageKey);
    }

    res.json({
      ...safeListing,
      imageUrl,
      agentReputation: {
        completedJobs,
        avgRating,
        avgPaymentSpeedHours,
      },
      hasApplied,
      applicationStatus,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get listing detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/apply - Apply to listing
router.post('/:id/apply', applyRateLimiter, authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const data = applySchema.parse(req.body);

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check listing is open
    if (listing.status !== 'OPEN') {
      return res.status(400).json({
        error: 'Listing not available',
        message: `This listing is ${listing.status.toLowerCase()}.`,
      });
    }

    // Check expiry
    if (listing.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Listing expired',
        message: 'This listing has expired.',
      });
    }

    // Check spots available
    if (listing.maxApplicants) {
      const currentApplicants = await prisma.listingApplication.count({
        where: {
          listingId: listing.id,
          status: { in: ['PENDING', 'PENDING_RECONFIRM', 'OFFERED'] },
        },
      });

      if (currentApplicants >= listing.maxApplicants) {
        return res.status(400).json({
          error: 'Listing full',
          message: 'This listing has reached the maximum number of applicants.',
        });
      }
    }

    // Create application with snapshot of current listing terms
    const application = await prisma.listingApplication.create({
      data: {
        listingId: listing.id,
        humanId: req.userId!,
        pitch: data.pitch,
        status: 'PENDING',
        listingSnapshot: buildListingSnapshot(listing),
      },
    });

    // Track event
    trackServerEvent(req.userId!, 'listing_application_submitted', {
      listingId: listing.id,
      agentId: listing.agentId,
    }, req);

    res.status(201).json({
      id: application.id,
      status: application.status,
      message: 'Application submitted successfully.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    // Check for unique constraint violation
    if ((error as any).code === 'P2002') {
      return res.status(400).json({
        error: 'Already applied',
        message: 'You have already applied to this listing.',
      });
    }
    logger.error({ err: error }, 'Apply to listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/application - Update application pitch / cover letter
router.patch('/:id/application', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const data = updateApplicationSchema.parse(req.body);

    const application = await prisma.listingApplication.findFirst({
      where: {
        listingId: req.params.id,
        humanId: req.userId!,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only allow editing PENDING applications
    if (application.status !== 'PENDING' && application.status !== 'PENDING_RECONFIRM') {
      return res.status(400).json({
        error: 'Cannot edit',
        message: 'You can only edit pending applications.',
      });
    }

    const updated = await prisma.listingApplication.update({
      where: { id: application.id },
      data: { pitch: data.pitch },
    });

    res.json({
      id: updated.id,
      pitch: updated.pitch,
      status: updated.status,
      message: 'Application updated successfully.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/compare - Compare current listing with original snapshot (human applicant)
router.get('/:id/compare', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const appId = req.query.app as string | undefined;

    // Find the human's application for this listing
    const where: any = {
      listingId: req.params.id,
      humanId: req.userId!,
    };
    if (appId) where.id = appId;

    const application = await prisma.listingApplication.findFirst({
      where,
      include: {
        listing: {
          select: {
            id: true, title: true, description: true,
            budgetUsdc: true, budgetFlexible: true,
            workMode: true, location: true,
            locationStreet: true, locationCountry: true,
            locationRegion: true, locationLocality: true,
            locationPostal: true,
            locationLat: true, locationLng: true,
            radiusKm: true, status: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'You have not applied to this listing.',
      });
    }

    const snapshot = application.listingSnapshot as Record<string, any> | null;

    // Build diff: for each material field, show original vs current
    const current = {
      title: application.listing.title,
      description: application.listing.description,
      budgetUsdc: application.listing.budgetUsdc.toString(),
      budgetFlexible: application.listing.budgetFlexible,
      workMode: application.listing.workMode,
      location: application.listing.location,
      locationLat: application.listing.locationLat,
      locationLng: application.listing.locationLng,
      radiusKm: application.listing.radiusKm,
    };

    const changes: Record<string, { original: any; current: any }> = {};
    if (snapshot) {
      for (const field of MATERIAL_FIELDS) {
        const orig = snapshot[field];
        const curr = (current as any)[field];
        if (JSON.stringify(orig) !== JSON.stringify(curr)) {
          changes[field] = { original: orig ?? null, current: curr ?? null };
        }
      }
    }

    res.json({
      applicationId: application.id,
      applicationStatus: application.status,
      listingId: application.listing.id,
      listingStatus: application.listing.status,
      original: snapshot || null,
      current,
      changes,
      hasChanges: Object.keys(changes).length > 0,
    });
  } catch (error) {
    logger.error({ err: error }, 'Compare listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/reconfirm - Reconfirm application after listing terms changed
router.post('/:id/reconfirm', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.listingApplication.findFirst({
      where: {
        listingId: req.params.id,
        humanId: req.userId!,
        status: 'PENDING_RECONFIRM',
      },
      include: { listing: { select: { title: true, status: true } } },
    });

    if (!application) {
      return res.status(404).json({
        error: 'No application pending reconfirmation',
        message: 'You do not have a pending reconfirmation for this listing.',
      });
    }

    if (application.listing.status !== 'OPEN') {
      return res.status(400).json({
        error: 'Listing no longer open',
        message: `This listing is now ${application.listing.status.toLowerCase()}.`,
      });
    }

    // Update snapshot to current listing terms and reconfirm
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    await prisma.listingApplication.update({
      where: { id: application.id },
      data: {
        status: 'PENDING',
        listingSnapshot: buildListingSnapshot(listing),
      },
    });

    trackServerEvent(req.userId!, 'listing_application_reconfirmed', {
      listingId: listing.id,
      applicationId: application.id,
    }, req);

    res.json({
      id: application.id,
      status: 'PENDING',
      message: 'Application reconfirmed with updated listing terms.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Reconfirm application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/applications - View applications (agent owns listing)
router.get('/:id/applications', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check agent owns the listing
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'You can only view applications for your own listings.',
      });
    }

    const applications = await prisma.listingApplication.findMany({
      where: { listingId: listing.id },
      orderBy: { createdAt: 'asc' },
      include: {
        human: {
          select: {
            id: true,
            name: true,
            bio: true,
            skills: true,
            equipment: true,
            location: true,
            locationLat: true,
            locationLng: true,
          },
        },
      },
    });

    // Get review stats for each human
    const humanIds = applications.map(a => a.humanId);
    const humanStats = await Promise.all(
      humanIds.map(async (humanId) => {
        const [completedJobs, reviews] = await Promise.all([
          prisma.job.count({
            where: {
              humanId,
              status: 'COMPLETED',
            },
          }),
          prisma.review.findMany({
            where: { humanId },
            select: { rating: true },
          }),
        ]);

        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null;

        return {
          humanId,
          completedJobs,
          avgRating,
        };
      })
    );

    const humanStatsMap = Object.fromEntries(
      humanStats.map(s => [s.humanId, { completedJobs: s.completedJobs, avgRating: s.avgRating }])
    );

    // Format response with truncated bio
    const formattedApplications = applications.map((app) => ({
      ...app,
      human: {
        ...app.human,
        bio: app.human.bio ? (app.human.bio.length > 200 ? app.human.bio.substring(0, 200) + '...' : app.human.bio) : null,
        reputation: humanStatsMap[app.humanId] || { completedJobs: 0, avgRating: null },
      },
    }));

    res.json(formattedApplications);
  } catch (error) {
    logger.error({ err: error }, 'Get applications error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/applications/:appId/offer - Make offer
router.post('/:id/applications/:appId/offer', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const data = makeOfferSchema.parse(req.body);

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check agent owns the listing
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'You can only make offers for your own listings.',
      });
    }

    const application = await prisma.listingApplication.findUnique({
      where: { id: req.params.appId },
      include: {
        human: {
          select: {
            id: true,
            name: true,
            email: true,
            contactEmail: true,
            emailVerified: true,
            emailNotifications: true,
            preferredLanguage: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check application belongs to this listing
    if (application.listingId !== listing.id) {
      return res.status(400).json({
        error: 'Invalid application',
        message: 'This application does not belong to the specified listing.',
      });
    }

    // Check application is pending
    if (application.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Invalid application status',
        message: `Cannot make an offer for an application with status: ${application.status}`,
      });
    }

    // Create job from listing
    const job = await prisma.job.create({
      data: {
        humanId: application.humanId,
        agentId: listing.agentId,
        agentName: req.agent!.name,
        registeredAgentId: req.agent!.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        priceUsdc: listing.budgetUsdc,
        paymentMode: 'ONE_TIME',
        paymentTiming: 'upfront',
        callbackUrl: listing.callbackUrl,
        callbackSecret: listing.callbackSecret,
        status: 'PENDING',
      },
    });

    // Update application status and link to job
    await prisma.listingApplication.update({
      where: { id: application.id },
      data: {
        status: 'OFFERED',
        jobId: job.id,
      },
    });

    const jobDetailUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/${job.id}`;

    // Send email notification
    const notifyEmail = application.human.contactEmail || application.human.email;
    if (notifyEmail && application.human.emailNotifications) {
      sendJobOfferEmail({
        humanName: application.human.name,
        humanEmail: notifyEmail,
        humanId: application.human.id,
        jobTitle: job.title,
        jobDescription: job.description,
        priceUsdc: listing.budgetUsdc.toNumber(),
        agentName: req.agent!.name,
        category: job.category || undefined,
        language: application.human.preferredLanguage,
        jobDetailUrl,
        jobId: job.id,
        agentId: req.agent!.id,
      }).catch((err) => logger.error({ err }, 'Job offer email notification failed'));
    }

    // Track event
    trackServerEvent(req.agent!.id, 'listing_offer_made', {
      listingId: listing.id,
      applicationId: application.id,
      jobId: job.id,
      humanId: application.humanId,
    }, req);

    res.status(201).json({
      id: job.id,
      applicationId: application.id,
      status: job.status,
      message: 'Job offer created from listing application. This is a binding commitment.',
      warning: 'By making this offer, you commit to paying the agreed amount if the human accepts and completes the work.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Make offer error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rate limiter for image changes: 5 per hour per agent
const imageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.agent?.id || 'unknown',
  message: { error: 'Too many image requests. Limit: 5 per hour.' },
  validate: false,
});

// POST /:id/image - Upload a custom listing cover image
router.post('/:id/image', authenticateAgent, requireActiveAgent, imageRateLimiter, imageUpload.single('image'), async (req: AgentAuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Not authorized', message: 'You can only upload images for your own listings.' });
    }

    // Process: resize to 600x400 landscape cover, WebP
    let processed: Buffer;
    try {
      processed = await sharp(req.file.buffer)
        .rotate()
        .resize(600, 400, { fit: 'cover', position: 'centre' })
        .withMetadata({ orientation: undefined })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      return res.status(400).json({ error: 'Invalid image file.' });
    }

    // Delete old image if exists
    if (listing.imageKey) {
      await deleteProfilePhoto(listing.imageKey);
    }

    // Upload to R2
    const key = await uploadProfilePhoto(listing.id, processed);

    // Update DB
    await prisma.listing.update({
      where: { id: listing.id },
      data: { imageKey: key, imageStatus: 'pending' },
    });

    // Queue moderation
    await queueModeration('listing_image', listing.id);

    const imageUrl = await getProfilePhotoSignedUrl(key);
    res.json({ imageUrl, imageStatus: 'pending' });
  } catch (error) {
    logger.error({ err: error }, 'Listing image upload error');
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// POST /:id/generate-image - AI-generate a listing cover image via DALL-E
router.post('/:id/generate-image', authenticateAgent, requireActiveAgent, imageRateLimiter, async (req: AgentAuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Not authorized', message: 'You can only generate images for your own listings.' });
    }

    // Moderate the listing text first (prevent generating images from harmful prompts)
    const textResult = await moderateText(`${listing.title} ${listing.description}`);
    if (textResult.flagged) {
      return res.status(400).json({
        error: 'Content flagged',
        message: 'Listing text was flagged by moderation. Cannot generate image.',
      });
    }

    // Build safe DALL-E prompt
    const prompt = `Professional, clean illustration for a job listing titled "${listing.title.substring(0, 100)}". Style: modern flat design, abstract, no text or words in the image, suitable for a job board thumbnail. Vibrant but professional colors.`;

    // Call OpenAI DALL-E (uses round-robin key rotation)
    const openai = createOpenAIClient({ maxRetries: 2, timeout: 60_000 });
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: 'Image generation failed' });
    }

    // Process to 600x400 WebP
    const imageBuffer = Buffer.from(b64, 'base64');
    const processed = await sharp(imageBuffer)
      .resize(600, 400, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();

    // Delete old image if exists
    if (listing.imageKey) {
      await deleteProfilePhoto(listing.imageKey);
    }

    // Upload to R2
    const key = await uploadProfilePhoto(listing.id, processed);

    // Update DB
    await prisma.listing.update({
      where: { id: listing.id },
      data: { imageKey: key, imageStatus: 'pending' },
    });

    // Queue moderation on the generated image
    await queueModeration('listing_image', listing.id);

    const imageUrl = await getProfilePhotoSignedUrl(key);

    trackServerEvent(req.agent!.id, 'listing_image_generated', {
      listingId: listing.id,
      method: 'dalle',
    }, req);

    res.json({ imageUrl, imageStatus: 'pending', method: 'dalle' });
  } catch (error) {
    logger.error({ err: error }, 'Listing image generation error');
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Handle multer errors for image uploads
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.includes('Only JPEG')) {
    return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' });
  }
  next(err);
});

// Schema for updating a listing (all fields optional)
const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z.string().max(100).optional().nullable(),
  budgetUsdc: z.number().min(5, 'Minimum budget is $5').optional(),
  budgetFlexible: z.boolean().optional(),
  requiredSkills: z.array(z.string().max(100)).max(30).optional(),
  requiredEquipment: z.array(z.string().max(100)).max(30).optional(),
  location: z.string().optional().nullable(),
  locationStreet: z.string().max(500).optional().nullable(),
  locationCountry: z.string().max(2).optional().nullable(),
  locationRegion: z.string().max(200).optional().nullable(),
  locationLocality: z.string().max(200).optional().nullable(),
  locationPostal: z.string().max(20).optional().nullable(),
  locationLat: z.number().min(-90).max(90).optional().nullable(),
  locationLng: z.number().min(-180).max(180).optional().nullable(),
  radiusKm: z.number().int().min(1).optional().nullable(),
  workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional().nullable(),
  expiresAt: z.string().refine((val) => {
    const date = new Date(val);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return date > now && date <= maxDate;
  }, 'expiresAt must be in the future and within 90 days').optional(),
  maxApplicants: z.number().int().min(1).max(10000).optional().nullable(),
  callbackUrl: z.string().url().optional().nullable(),
  callbackSecret: z.string().min(16).max(256).optional().nullable(),
  // Image update options (mutually exclusive)
  imageUrl: z.string().url().optional(),
  generateImage: z.literal(true).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
}).refine((data) => !(data.imageUrl && data.generateImage), {
  message: 'Cannot use both imageUrl and generateImage. Choose one.',
});

// PATCH /:id - Update a listing
router.patch('/:id', authenticateAgent, requireActiveAgent, updateRateLimiter, async (req: AgentAuthRequest, res) => {
  try {
    const data = updateListingSchema.parse(req.body);
    const agent = req.agent!;

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.agentId !== agent.id) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'You can only update your own listings.',
      });
    }

    if (listing.status !== 'OPEN') {
      return res.status(409).json({
        error: 'Listing not editable',
        message: `Cannot update a listing with status "${listing.status}". Only OPEN listings can be updated.`,
      });
    }

    // SSRF prevention: validate callback URL if provided
    if (data.callbackUrl && !(await isAllowedUrl(data.callbackUrl))) {
      return res.status(400).json({
        error: 'Invalid callback URL',
        message: 'Callback URL must be a public HTTP(S) endpoint',
      });
    }

    // Build update payload — only include provided fields
    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.budgetUsdc !== undefined) updateData.budgetUsdc = new Decimal(data.budgetUsdc);
    if (data.budgetFlexible !== undefined) updateData.budgetFlexible = data.budgetFlexible;
    if (data.requiredSkills !== undefined) updateData.requiredSkills = data.requiredSkills;
    if (data.requiredEquipment !== undefined) updateData.requiredEquipment = data.requiredEquipment;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.locationStreet !== undefined) updateData.locationStreet = data.locationStreet;
    if (data.locationCountry !== undefined) updateData.locationCountry = data.locationCountry;
    if (data.locationRegion !== undefined) updateData.locationRegion = data.locationRegion;
    if (data.locationLocality !== undefined) updateData.locationLocality = data.locationLocality;
    if (data.locationPostal !== undefined) updateData.locationPostal = data.locationPostal;
    if (data.locationLat !== undefined) updateData.locationLat = data.locationLat;
    if (data.locationLng !== undefined) updateData.locationLng = data.locationLng;
    if (data.radiusKm !== undefined) updateData.radiusKm = data.radiusKm;
    if (data.workMode !== undefined) updateData.workMode = data.workMode;
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);
    if (data.maxApplicants !== undefined) updateData.maxApplicants = data.maxApplicants;
    if (data.callbackUrl !== undefined) updateData.callbackUrl = data.callbackUrl;
    if (data.callbackSecret !== undefined) updateData.callbackSecret = data.callbackSecret;

    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: updateData,
    });

    // ── Image handling (mutually exclusive options) ──
    let imageResult: { imageUrl?: string | null; imageStatus?: string; imageMethod?: string } = {};

    if (data.imageUrl) {
      // Option 1: Download image from agent-provided URL
      try {
        const rawBuffer = await downloadExternalImage(data.imageUrl);
        const processed = await sharp(rawBuffer)
          .rotate()
          .resize(600, 400, { fit: 'cover', position: 'centre' })
          .withMetadata({ orientation: undefined })
          .webp({ quality: 80 })
          .toBuffer();

        if (listing.imageKey) {
          await deleteProfilePhoto(listing.imageKey);
        }

        const key = await uploadProfilePhoto(updated.id, processed);
        await prisma.listing.update({
          where: { id: updated.id },
          data: { imageKey: key, imageStatus: 'pending' },
        });

        await queueModeration('listing_image', updated.id);

        const signedUrl = await getProfilePhotoSignedUrl(key);
        imageResult = { imageUrl: signedUrl, imageStatus: 'pending', imageMethod: 'url' };
      } catch (imgErr: any) {
        return res.status(400).json({
          error: 'Image download failed',
          message: imgErr?.message || 'Could not download or process the image from the provided URL.',
        });
      }
    } else if (data.generateImage) {
      // Option 2: AI-generate cover via DALL-E
      try {
        const textResult = await moderateText(`${updated.title} ${updated.description}`);
        if (textResult.flagged) {
          return res.status(400).json({
            error: 'Content flagged',
            message: 'Listing text was flagged by moderation. Cannot generate image.',
          });
        }

        const prompt = `Professional, clean illustration for a job listing titled "${updated.title.substring(0, 100)}". Style: modern flat design, abstract, no text or words in the image, suitable for a job board thumbnail. Vibrant but professional colors.`;

        const openai = createOpenAIClient({ maxRetries: 2, timeout: 60_000 });
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
          return res.status(500).json({ error: 'Image generation failed' });
        }

        const imageBuffer = Buffer.from(b64, 'base64');
        const processed = await sharp(imageBuffer)
          .resize(600, 400, { fit: 'cover', position: 'centre' })
          .webp({ quality: 80 })
          .toBuffer();

        if (listing.imageKey) {
          await deleteProfilePhoto(listing.imageKey);
        }

        const key = await uploadProfilePhoto(updated.id, processed);
        await prisma.listing.update({
          where: { id: updated.id },
          data: { imageKey: key, imageStatus: 'pending' },
        });

        await queueModeration('listing_image', updated.id);

        const signedUrl = await getProfilePhotoSignedUrl(key);
        imageResult = { imageUrl: signedUrl, imageStatus: 'pending', imageMethod: 'dalle' };
      } catch (genErr) {
        logger.error({ err: genErr, listingId: updated.id }, 'DALL-E image generation error during update');
        return res.status(500).json({ error: 'Failed to generate image' });
      }
    } else if (data.title !== undefined || data.category !== undefined) {
      // Auto-regenerate SVG cover when title or category changed (no explicit image option)
      try {
        const coverBuffer = await generateListingCover(
          updated.title,
          updated.category ?? undefined,
        );
        const coverKey = await uploadProfilePhoto(updated.id, coverBuffer);
        await prisma.listing.update({
          where: { id: updated.id },
          data: { imageKey: coverKey, imageStatus: 'approved' },
        });
      } catch (coverErr) {
        logger.warn({ err: coverErr, listingId: updated.id }, 'Failed to regenerate listing cover after update');
      }
    }

    // ── Reconfirm flow: notify applicants if material terms changed ──
    const materialChanged = MATERIAL_FIELDS.filter(f => (data as any)[f] !== undefined);
    let reconfirmCount = 0;

    if (materialChanged.length > 0) {
      // Find all PENDING (active) applications that need reconfirmation
      const affectedApps = await prisma.listingApplication.findMany({
        where: {
          listingId: listing.id,
          status: 'PENDING',
        },
        include: {
          human: {
            select: { id: true, name: true, email: true, emailNotifications: true, preferredLanguage: true },
          },
        },
      });

      if (affectedApps.length > 0) {
        // Bulk-update all PENDING → PENDING_RECONFIRM
        await prisma.listingApplication.updateMany({
          where: {
            listingId: listing.id,
            status: 'PENDING',
          },
          data: { status: 'PENDING_RECONFIRM' },
        });
        reconfirmCount = affectedApps.length;

        // Send email notifications (fire-and-forget, don't block response)
        const compareBaseUrl = `${process.env.FRONTEND_URL || 'https://humanpages.ai'}/listings/${listing.id}/compare`;
        for (const app of affectedApps) {
          if (app.human.emailNotifications) {
            sendListingTermsChangedEmail({
              humanName: app.human.name,
              humanEmail: app.human.email,
              humanId: app.human.id,
              listingTitle: updated.title,
              agentName: agent.name,
              changedFields: materialChanged,
              compareUrl: `${compareBaseUrl}?app=${app.id}`,
              language: app.human.preferredLanguage || undefined,
            }).catch(err => logger.error({ err, appId: app.id }, 'Failed to send listing terms changed email'));
          }
        }
      }
    }

    // Fire webhook
    if (updated.callbackUrl) {
      const payload = {
        event: 'listing.updated',
        listingId: updated.id,
        status: updated.status,
        timestamp: new Date().toISOString(),
        data: {
          title: updated.title,
          description: updated.description,
          budgetUsdc: updated.budgetUsdc.toString(),
          updatedFields: Object.keys(data),
          ...(reconfirmCount > 0 ? { applicantsNeedReconfirm: reconfirmCount } : {}),
        },
      };
      deliverWebhook(updated.callbackUrl, payload, updated.callbackSecret).catch((err) =>
        logger.error({ err, listingId: updated.id }, 'Webhook delivery error'),
      );
    }

    trackServerEvent(agent.id, 'listing_updated', {
      listingId: updated.id,
      updatedFields: Object.keys(data),
      ...(reconfirmCount > 0 ? { applicantsNeedReconfirm: reconfirmCount } : {}),
    }, req);

    res.json({
      id: updated.id,
      status: updated.status,
      message: reconfirmCount > 0
        ? `Listing updated successfully. ${reconfirmCount} applicant(s) have been notified and must reconfirm.`
        : 'Listing updated successfully.',
      updatedFields: Object.keys(data),
      ...(reconfirmCount > 0 ? { applicantsNeedReconfirm: reconfirmCount } : {}),
      ...imageResult,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - Cancel listing
router.delete('/:id', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check agent owns the listing
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'You can only cancel your own listings.',
      });
    }

    // Update listing status
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'CANCELLED' },
    });

    // Reject all pending applications (including those awaiting reconfirmation)
    await prisma.listingApplication.updateMany({
      where: {
        listingId: listing.id,
        status: { in: ['PENDING', 'PENDING_RECONFIRM'] },
      },
      data: { status: 'REJECTED' },
    });

    // Fire webhook
    if (listing.callbackUrl) {
      const payload = {
        event: 'listing.cancelled',
        listingId: listing.id,
        status: 'CANCELLED',
        timestamp: new Date().toISOString(),
        data: {
          title: listing.title,
          description: listing.description,
        },
      };
      deliverWebhook(listing.callbackUrl, payload, listing.callbackSecret).catch((err) =>
        logger.error({ err, listingId: listing.id }, 'Webhook delivery error'),
      );
    }

    res.json({
      id: listing.id,
      status: 'CANCELLED',
      message: 'Listing cancelled successfully. All pending applications have been rejected.',
    });
  } catch (error) {
    logger.error({ err: error }, 'Cancel listing error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Short link endpoints ─────────────────────────────────────────────────────

// GET /:id/links - Get all short links for a listing (admin/agent)
router.get('/:id/links', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      select: { id: true, agentId: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const links = await prisma.listingLink.findMany({
      where: { listingId: listing.id },
      orderBy: { createdAt: 'asc' },
      select: { code: true, label: true, clicks: true, createdAt: true },
    });

    res.json(links.map(l => ({
      ...l,
      url: `https://humanpages.ai/work/${l.code}`,
    })));
  } catch (error) {
    logger.error({ err: error }, 'Get listing links error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/links/:code - Update link label (admin/agent)
router.put('/:id/links/:code', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      select: { id: true, agentId: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.agentId !== req.agent!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { label } = z.object({ label: z.string().max(100) }).parse(req.body);

    const link = await prisma.listingLink.findFirst({
      where: { code: req.params.code.toLowerCase(), listingId: listing.id },
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    await prisma.listingLink.update({
      where: { id: link.id },
      data: { label },
    });

    res.json({ code: link.code, label, message: 'Label updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update listing link error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
