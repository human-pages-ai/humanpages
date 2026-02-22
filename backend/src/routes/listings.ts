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
import { calculateDistance } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { trackServerEvent } from '../lib/posthog.js';
import { createOpenAIClient } from '../lib/openai-keys.js';
import { isAllowedUrl, deliverWebhook } from '../lib/webhook.js';
import { sendJobOfferEmail } from '../lib/email.js';
import { processProfileImage, uploadProfilePhoto, getProfilePhotoSignedUrl, deleteProfilePhoto } from '../lib/storage.js';
import { queueModeration, moderateText } from '../lib/moderation.js';
import { generateListingCover } from '../lib/listingCovers.js';
import sharp from 'sharp';

const router = Router();

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
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        radiusKm: data.radiusKm,
        workMode: data.workMode,
        expiresAt: new Date(data.expiresAt),
        maxApplicants: data.maxApplicants,
        isPro,
        callbackUrl: data.callbackUrl,
        callbackSecret: data.callbackSecret,
        status: 'OPEN',
      },
    });

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

    // Fetch listings
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy: [
          { isPro: 'desc' }, // PRO listings first
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
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    // Location filter (post-query filtering for distance calculation)
    let filteredListings = listings;
    if (req.query.lat && req.query.lng && req.query.radius) {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string);

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
        filteredListings = listings.filter((listing) => {
          if (!listing.locationLat || !listing.locationLng) return false;
          const distance = calculateDistance(lat, lng, listing.locationLat, listing.locationLng);
          return distance <= radius;
        });
      }
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
        total: req.query.lat ? filteredListings.length : total,
        totalPages: Math.ceil((req.query.lat ? filteredListings.length : total) / limit),
      },
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
          status: { in: ['PENDING', 'OFFERED'] },
        },
      });

      if (currentApplicants >= listing.maxApplicants) {
        return res.status(400).json({
          error: 'Listing full',
          message: 'This listing has reached the maximum number of applicants.',
        });
      }
    }

    // Create application (unique constraint handles duplicate applications)
    const application = await prisma.listingApplication.create({
      data: {
        listingId: listing.id,
        humanId: req.userId!,
        pitch: data.pitch,
        status: 'PENDING',
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

// POST /:id/image - Upload a custom listing cover image
router.post('/:id/image', authenticateAgent, requireActiveAgent, imageUpload.single('image'), async (req: AgentAuthRequest, res) => {
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
router.post('/:id/generate-image', x402PaymentCheck('listing_image_generate'), authenticateAgent, requireActiveOrPaid, async (req: X402Request, res) => {
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

    // Reject all pending applications
    await prisma.listingApplication.updateMany({
      where: {
        listingId: listing.id,
        status: 'PENDING',
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

export default router;
