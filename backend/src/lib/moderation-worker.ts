import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { moderateImage, moderateText, isModerationEnabled, OpenAIRateLimitError } from './moderation.js';
import { getR2ObjectBuffer } from './storage.js';
import { fireWebhook } from './webhook.js';
import { sendModerationDelayEmail } from './email.js';

const POLL_INTERVAL = 10_000; // 10 seconds
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000; // 1 minute fallback
const DELAY_NOTIFICATION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — send email after this

let intervalId: NodeJS.Timeout | null = null;
/** When set, the worker skips processing until this timestamp. */
let rateLimitBackoffUntil: number = 0;

export function startModerationWorker(): void {
  if (!isModerationEnabled()) {
    logger.info('Moderation worker disabled (no OPENAI_API_KEY)');
    return;
  }
  logger.info('Starting moderation worker');
  intervalId = setInterval(processModerationQueue, POLL_INTERVAL);
}

export function stopModerationWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function processModerationQueue(): Promise<void> {
  // If we're backing off due to a rate limit, skip processing but still check for delayed items
  if (Date.now() < rateLimitBackoffUntil) {
    const remainingSec = Math.ceil((rateLimitBackoffUntil - Date.now()) / 1000);
    logger.debug({ remainingSec }, 'Moderation worker backing off (OpenAI rate limit)');
    // Still notify humans about delays even while backed off
    await checkDelayedItems().catch((err) =>
      logger.error({ err }, 'Failed to check delayed moderation items'),
    );
    return;
  }

  try {
    const items = await prisma.moderationQueue.findMany({
      where: {
        status: 'pending',
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (items.length === 0) return;

    for (const item of items) {
      try {
        await processItem(item);
      } catch (err) {
        // On rate limit, pause the entire worker — no point hammering the API
        if (err instanceof OpenAIRateLimitError) {
          const backoffMs = err.retryAfterSeconds
            ? err.retryAfterSeconds * 1000
            : DEFAULT_RATE_LIMIT_BACKOFF_MS;
          rateLimitBackoffUntil = Date.now() + backoffMs;
          logger.warn(
            { backoffMs, itemId: item.id },
            'OpenAI rate limit reached — pausing moderation worker',
          );
          // Don't increment attempts for rate limits; it's not the item's fault
          // Still check for delayed notifications before returning
          break;
        }

        logger.error({ err, itemId: item.id, contentType: item.contentType }, 'Failed to process moderation item');

        await prisma.moderationQueue.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            status: item.attempts + 1 >= MAX_ATTEMPTS ? 'error' : 'pending',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    }
  } catch (err) {
    logger.error({ err }, 'Moderation worker queue processing error');
  }

  // Always check for items that have been pending too long and notify humans
  await checkDelayedItems().catch((err) =>
    logger.error({ err }, 'Failed to check delayed moderation items'),
  );
}

async function processItem(item: { id: string; contentType: string; contentId: string }): Promise<void> {
  switch (item.contentType) {
    case 'profile_photo':
      await processProfilePhoto(item);
      break;
    case 'job_posting':
      await processJobPosting(item);
      break;
    case 'human_report':
      await processHumanReport(item);
      break;
    case 'agent_report':
      await processAgentReport(item);
      break;
    case 'listing_image':
      await processListingImage(item);
      break;
    default:
      logger.warn({ contentType: item.contentType }, 'Unknown moderation content type');
      await prisma.moderationQueue.update({
        where: { id: item.id },
        data: { status: 'error', errorMessage: `Unknown content type: ${item.contentType}` },
      });
  }
}

async function processProfilePhoto(item: { id: string; contentId: string }): Promise<void> {
  const human = await prisma.human.findUnique({
    where: { id: item.contentId },
    select: { profilePhotoKey: true },
  });

  if (!human?.profilePhotoKey) {
    // Photo was deleted before moderation ran — skip
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date(), errorMessage: 'Source record deleted or no photo key' },
    });
    return;
  }

  const imageBuffer = await getR2ObjectBuffer(human.profilePhotoKey);
  if (!imageBuffer) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'error', errorMessage: 'Image not found in R2' },
    });
    return;
  }

  const result = await moderateImage(imageBuffer);
  const newStatus = result.flagged ? 'rejected' : 'approved';

  await prisma.$transaction([
    prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: newStatus, result: result as any, reviewedAt: new Date() },
    }),
    prisma.human.update({
      where: { id: item.contentId },
      data: { profilePhotoStatus: newStatus },
    }),
  ]);

  logger.info({ humanId: item.contentId, flagged: result.flagged }, 'Profile photo moderation complete');
}

async function processJobPosting(item: { id: string; contentId: string }): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: item.contentId },
    select: {
      id: true,
      title: true,
      description: true,
      priceUsdc: true,
      humanId: true,
      status: true,
      callbackUrl: true,
      callbackSecret: true,
    },
  });

  if (!job) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date(), errorMessage: 'Job deleted' },
    });
    return;
  }

  const result = await moderateText(`${job.title}\n${job.description}`);
  const newStatus = result.flagged ? 'rejected' : 'approved';

  await prisma.$transaction([
    prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: newStatus, result: result as any, reviewedAt: new Date() },
    }),
    prisma.job.update({
      where: { id: item.contentId },
      data: { moderationStatus: newStatus },
    }),
  ]);

  // Notify agent via webhook that moderation is complete
  fireWebhook(job, 'job.moderation_complete', {
    moderationStatus: newStatus,
    flagged: result.flagged,
  });

  logger.info({ jobId: item.contentId, flagged: result.flagged }, 'Job posting moderation complete');
}

async function processHumanReport(item: { id: string; contentId: string }): Promise<void> {
  const report = await prisma.humanReport.findUnique({
    where: { id: item.contentId },
    select: { description: true, status: true },
  });

  if (!report) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date(), errorMessage: 'Report deleted' },
    });
    return;
  }

  if (!report.description) {
    // No text to moderate
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date() },
    });
    return;
  }

  const result = await moderateText(report.description);

  // If the report text itself is spam/harassment, auto-dismiss the report
  if (result.flagged) {
    await prisma.$transaction([
      prisma.moderationQueue.update({
        where: { id: item.id },
        data: { status: 'rejected', result: result as any, reviewedAt: new Date() },
      }),
      prisma.humanReport.update({
        where: { id: item.contentId },
        data: { status: 'DISMISSED' },
      }),
    ]);
    logger.info({ reportId: item.contentId }, 'Human report auto-dismissed (flagged content)');
  } else {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', result: result as any, reviewedAt: new Date() },
    });
  }
}

async function processAgentReport(item: { id: string; contentId: string }): Promise<void> {
  const report = await prisma.agentReport.findUnique({
    where: { id: item.contentId },
    select: { description: true, status: true },
  });

  if (!report) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date(), errorMessage: 'Report deleted' },
    });
    return;
  }

  if (!report.description) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date() },
    });
    return;
  }

  const result = await moderateText(report.description);

  if (result.flagged) {
    await prisma.$transaction([
      prisma.moderationQueue.update({
        where: { id: item.id },
        data: { status: 'rejected', result: result as any, reviewedAt: new Date() },
      }),
      prisma.agentReport.update({
        where: { id: item.contentId },
        data: { status: 'DISMISSED' },
      }),
    ]);
    logger.info({ reportId: item.contentId }, 'Agent report auto-dismissed (flagged content)');
  } else {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', result: result as any, reviewedAt: new Date() },
    });
  }
}

async function processListingImage(item: { id: string; contentId: string }): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: item.contentId },
    select: { imageKey: true },
  });

  if (!listing?.imageKey) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'approved', reviewedAt: new Date(), errorMessage: 'Image deleted or no key' },
    });
    return;
  }

  const imageBuffer = await getR2ObjectBuffer(listing.imageKey);
  if (!imageBuffer) {
    await prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: 'error', errorMessage: 'Image not found in R2' },
    });
    return;
  }

  const result = await moderateImage(imageBuffer);
  const newStatus = result.flagged ? 'rejected' : 'approved';

  await prisma.$transaction([
    prisma.moderationQueue.update({
      where: { id: item.id },
      data: { status: newStatus, result: result as any, reviewedAt: new Date() },
    }),
    prisma.listing.update({
      where: { id: item.contentId },
      data: { imageStatus: newStatus },
    }),
  ]);

  logger.info({ listingId: item.contentId, flagged: result.flagged }, 'Listing image moderation complete');
}

// ---------------------------------------------------------------------------
// Delay notifications — send a friendly email when moderation takes too long
// ---------------------------------------------------------------------------

async function checkDelayedItems(): Promise<void> {
  const threshold = new Date(Date.now() - DELAY_NOTIFICATION_THRESHOLD_MS);

  // Find job_posting items that have been pending too long and haven't been notified yet
  const delayedItems = await prisma.moderationQueue.findMany({
    where: {
      status: 'pending',
      contentType: 'job_posting',
      createdAt: { lt: threshold },
      notifiedAt: null,
    },
    take: 10,
  });

  if (delayedItems.length === 0) return;

  for (const item of delayedItems) {
    try {
      const job = await prisma.job.findUnique({
        where: { id: item.contentId },
        select: {
          id: true,
          title: true,
          humanId: true,
          human: {
            select: {
              name: true,
              email: true,
              contactEmail: true,
              emailNotifications: true,
              preferredLanguage: true,
            },
          },
        },
      });

      if (!job) {
        // Job was deleted — skip notification, mark as notified to avoid re-checking
        await prisma.moderationQueue.update({
          where: { id: item.id },
          data: { notifiedAt: new Date() },
        });
        continue;
      }

      const human = job.human;
      const email = human.contactEmail || human.email;

      if (email && human.emailNotifications) {
        const jobDetailUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs/${job.id}`;

        await sendModerationDelayEmail({
          humanName: human.name,
          humanEmail: email,
          humanId: job.humanId,
          jobTitle: job.title,
          jobDetailUrl,
          language: human.preferredLanguage ?? undefined,
        });

        logger.info({ jobId: job.id, humanId: job.humanId }, 'Sent moderation delay notification email');
      }

      // Mark as notified regardless of email preference — prevents re-checking
      await prisma.moderationQueue.update({
        where: { id: item.id },
        data: { notifiedAt: new Date() },
      });
    } catch (err) {
      logger.error({ err, itemId: item.id }, 'Failed to send moderation delay notification');
    }
  }
}
