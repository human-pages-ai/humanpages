import { prisma } from './prisma.js';
import { logger } from './logger.js';

// Configuration: timeout periods (in days)
const ACCEPTED_JOB_TIMEOUT_DAYS = parseInt(
  process.env.ACCEPTED_JOB_TIMEOUT_DAYS || '7',
  10
);
const PAYMENT_CLAIMED_TIMEOUT_DAYS = parseInt(
  process.env.PAYMENT_CLAIMED_TIMEOUT_DAYS || '14',
  10
);

// Run cleanup every 6 hours
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Auto-reject stale jobs that have been in ACCEPTED status too long.
 * This prevents agents from getting permanently locked by unresponsive humans.
 * Particularly important for BASIC tier (1 job per 48h) where one stale ACCEPTED job
 * blocks new job creation.
 */
async function cleanupStaleJobs(): Promise<void> {
  try {
    const now = new Date();

    // Calculate cutoff times
    const acceptedCutoff = new Date(
      now.getTime() - ACCEPTED_JOB_TIMEOUT_DAYS * 24 * 60 * 60 * 1000
    );
    const paymentClaimedCutoff = new Date(
      now.getTime() - PAYMENT_CLAIMED_TIMEOUT_DAYS * 24 * 60 * 60 * 1000
    );

    // Find and reject stale ACCEPTED jobs
    // Use acceptedAt (set when status moved to ACCEPTED), NOT updatedAt
    // which gets bumped by messages and other unrelated writes.
    const staleAcceptedResult = await prisma.job.updateMany({
      where: {
        status: 'ACCEPTED',
        acceptedAt: { not: null, lte: acceptedCutoff },
      },
      data: {
        status: 'REJECTED',
        lastActionBy: 'SYSTEM',
      },
    });

    if (staleAcceptedResult.count > 0) {
      logger.info(
        {
          count: staleAcceptedResult.count,
          timeoutDays: ACCEPTED_JOB_TIMEOUT_DAYS,
        },
        'Auto-rejected stale ACCEPTED jobs'
      );
    }

    // Find and reject stale PAYMENT_CLAIMED jobs
    // (agent claimed they paid, but human never confirmed receipt after timeout)
    // Use paymentClaimedAt (set when status moved to PAYMENT_CLAIMED).
    const stalePaymentClaimedResult = await prisma.job.updateMany({
      where: {
        status: 'PAYMENT_CLAIMED',
        paymentClaimedAt: { not: null, lte: paymentClaimedCutoff },
      },
      data: {
        status: 'REJECTED',
        lastActionBy: 'SYSTEM',
      },
    });

    if (stalePaymentClaimedResult.count > 0) {
      logger.info(
        {
          count: stalePaymentClaimedResult.count,
          timeoutDays: PAYMENT_CLAIMED_TIMEOUT_DAYS,
        },
        'Auto-rejected stale PAYMENT_CLAIMED jobs'
      );
    }

    const totalRejected = staleAcceptedResult.count + stalePaymentClaimedResult.count;
    if (totalRejected === 0) {
      logger.debug('No stale jobs found for cleanup');
    }
  } catch (err) {
    logger.error({ err }, 'Stale job cleanup failed');
  }
}

/**
 * Start the stale job cleanup worker.
 * Runs every 6 hours and auto-rejects jobs that have been stale too long.
 */
export function startStaleJobCleanup(): void {
  if (intervalId) return;

  logger.info(
    {
      acceptedJobTimeoutDays: ACCEPTED_JOB_TIMEOUT_DAYS,
      paymentClaimedTimeoutDays: PAYMENT_CLAIMED_TIMEOUT_DAYS,
      intervalHours: CLEANUP_INTERVAL_MS / (60 * 60 * 1000),
    },
    'Starting stale job cleanup worker'
  );

  // Run immediately after a short delay to allow startup to complete
  setTimeout(() => cleanupStaleJobs(), 30 * 1000);

  // Then run on regular interval
  intervalId = setInterval(() => cleanupStaleJobs(), CLEANUP_INTERVAL_MS);
}

/**
 * Stop the stale job cleanup worker.
 * Called during graceful shutdown.
 */
export function stopStaleJobCleanup(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Stale job cleanup worker stopped');
  }
}

/**
 * Exported for testing: returns the configured timeout values
 */
export function getStaleJobTimeouts() {
  return {
    acceptedJobTimeoutDays: ACCEPTED_JOB_TIMEOUT_DAYS,
    paymentClaimedTimeoutDays: PAYMENT_CLAIMED_TIMEOUT_DAYS,
  };
}
