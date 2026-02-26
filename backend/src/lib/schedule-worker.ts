import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { publishContent } from './social-publish.js';
import { notifySlackEngagement, notifySlackCrosspost } from './slack.js';

const INTERVAL = 60 * 1000; // Every 60 seconds

async function processDueEntries() {
  try {
    const now = new Date();

    const dueEntries = await prisma.publicationSchedule.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      include: {
        contentItem: true,
      },
    });

    if (dueEntries.length === 0) return;

    logger.info({ count: dueEntries.length }, 'Processing due schedule entries');

    for (const entry of dueEntries) {
      try {
        // Mark as PUBLISHING
        await prisma.publicationSchedule.update({
          where: { id: entry.id },
          data: { status: 'PUBLISHING' },
        });

        if (!entry.contentItem) {
          await prisma.publicationSchedule.update({
            where: { id: entry.id },
            data: {
              status: 'FAILED',
              errorMessage: 'No linked content item found',
            },
          });
          logger.warn({ entryId: entry.id }, 'Schedule entry has no linked content item');
          continue;
        }

        const item = entry.contentItem;
        const result = await publishContent(item as any);

        if (result.success) {
          // Update schedule entry
          await prisma.publicationSchedule.update({
            where: { id: entry.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              publishedUrl: result.url || undefined,
            },
          });

          // Update content item
          await prisma.contentItem.update({
            where: { id: item.id },
            data: {
              status: 'PUBLISHED',
              publishedUrl: result.url || undefined,
              publishedAt: new Date(),
              manualInstructions: result.manualInstructions || undefined,
            },
          });

          // Slack notifications (same pattern as content.ts publish route)
          if (item.platform !== 'BLOG') {
            notifySlackEngagement({
              title: item.sourceTitle || item.blogTitle || 'New content published',
              url: result.url || '',
              platform: item.platform,
            }).catch(err => logger.error({ err }, 'Slack engagement notify failed'));
          }

          if (item.platform === 'BLOG' && item.blogSlug) {
            notifySlackCrosspost(
              item.blogTitle || item.sourceTitle || 'Untitled post',
              item.blogSlug,
            ).catch(err => logger.error({ err }, 'Slack crosspost notify failed'));
          }

          logger.info(
            { entryId: entry.id, contentItemId: item.id, platform: item.platform },
            'Scheduled content published successfully',
          );
        } else {
          await prisma.publicationSchedule.update({
            where: { id: entry.id },
            data: {
              status: 'FAILED',
              errorMessage: result.error || 'Unknown publish error',
            },
          });

          logger.error(
            { entryId: entry.id, contentItemId: item.id, error: result.error },
            'Scheduled content publish failed',
          );
        }
      } catch (err) {
        await prisma.publicationSchedule.update({
          where: { id: entry.id },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        logger.error({ err, entryId: entry.id }, 'Error processing schedule entry');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Schedule worker processing failed');
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduleWorker() {
  logger.info('Starting schedule worker');
  setTimeout(() => processDueEntries(), 15 * 1000); // 15s after startup
  timer = setInterval(() => processDueEntries(), INTERVAL);
}

export function stopScheduleWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
