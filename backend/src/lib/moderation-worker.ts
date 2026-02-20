import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { moderateImage, moderateText, isModerationEnabled } from './moderation.js';
import { getR2ObjectBuffer } from './storage.js';

const POLL_INTERVAL = 10_000; // 10 seconds
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;

let intervalId: NodeJS.Timeout | null = null;

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
    select: { title: true, description: true },
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
