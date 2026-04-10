import { prisma } from './prisma.js';
import { logger } from './logger.js';

const INTERVAL = 5 * 60 * 1000; // Every 5 minutes

async function processExpiredListings() {
  try {
    const now = new Date();

    // Find OPEN listings past expiresAt
    const expired = await prisma.listing.findMany({
      where: {
        status: 'OPEN',
        expiresAt: { lte: now },
      },
      select: { id: true, callbackUrl: true, callbackSecret: true },
    });

    if (expired.length === 0) return;

    // Batch update listings to EXPIRED
    await prisma.listing.updateMany({
      where: { id: { in: expired.map(l => l.id) } },
      data: { status: 'EXPIRED' },
    });

    // Set pending applications to REJECTED
    await prisma.listingApplication.updateMany({
      where: {
        listingId: { in: expired.map(l => l.id) },
        status: 'PENDING',
      },
      data: { status: 'REJECTED' },
    });

    // Fire webhooks for listings that have callback URLs
    // Lazy import to avoid circular deps
    const { fireWebhook } = await import('./webhook.js');
    for (const listing of expired) {
      if (listing.callbackUrl) {
        fireWebhook(
          { ...listing, status: 'EXPIRED' } as any,
          'listing.expired',
        );
      }
    }

    logger.info({ count: expired.length }, 'Expired listings processed');
  } catch (err) {
    logger.error({ err }, 'Listing expiry processing failed');
  }
}

/**
 * Auto-downgrade agents whose activation has expired.
 * Downgrade from any tier (PRO, WHALE, etc.) back to BASIC.
 */
async function processExpiredAgentActivations() {
  try {
    const now = new Date();

    // Find ACTIVE agents with expired activationExpiresAt
    const expiredCount = await prisma.agent.updateMany({
      where: {
        status: 'ACTIVE',
        activationExpiresAt: { lte: now },
      },
      data: {
        activationTier: 'BASIC',
      },
    });

    if (expiredCount.count > 0) {
      logger.info(
        { count: expiredCount.count },
        'Auto-downgraded expired agent activations to BASIC'
      );
    }
  } catch (err) {
    logger.error({ err }, 'Agent activation expiry processing failed');
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  await processExpiredListings();
  await processExpiredAgentActivations();
}

export function startListingExpiryWorker() {
  logger.info('Starting listing expiry worker');
  setTimeout(() => tick(), 15 * 1000); // 15s after startup
  timer = setInterval(() => tick(), INTERVAL);
}

export function stopListingExpiryWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
