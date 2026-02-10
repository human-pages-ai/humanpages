import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { sendDigestEmail } from './email.js';

const HOURLY_INTERVAL = 60 * 60 * 1000; // 1 hour
const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function processDigest(mode: 'HOURLY' | 'DAILY') {
  try {
    // Find humans with unsent notifications in this digest mode
    const humans = await prisma.human.findMany({
      where: {
        emailDigestMode: mode,
        pendingNotifications: {
          some: { sentAt: null },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactEmail: true,
        preferredLanguage: true,
        pendingNotifications: {
          where: { sentAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    for (const human of humans) {
      if (human.pendingNotifications.length === 0) continue;

      const notifyEmail = human.contactEmail || human.email;
      const notifications = human.pendingNotifications;

      try {
        await sendDigestEmail({
          humanName: human.name,
          humanEmail: notifyEmail,
          humanId: human.id,
          language: human.preferredLanguage,
          notifications: notifications.map(n => ({
            type: n.type,
            payload: n.payload as any,
            createdAt: n.createdAt,
          })),
        });

        // Mark all as sent
        await prisma.pendingNotification.updateMany({
          where: { id: { in: notifications.map(n => n.id) } },
          data: { sentAt: new Date() },
        });

        logger.info({ humanId: human.id, count: notifications.length, mode }, 'Digest email sent');
      } catch (err) {
        logger.error({ err, humanId: human.id }, 'Failed to send digest email');
      }
    }
  } catch (err) {
    logger.error({ err, mode }, 'Digest processing failed');
  }
}

async function cleanupOldNotifications() {
  try {
    const cutoff = new Date(Date.now() - CLEANUP_AGE_MS);
    const { count } = await prisma.pendingNotification.deleteMany({
      where: {
        sentAt: { not: null, lt: cutoff },
      },
    });
    if (count > 0) {
      logger.info({ count }, 'Cleaned up old sent notifications');
    }
  } catch (err) {
    logger.error({ err }, 'Notification cleanup failed');
  }
}

let hourlyTimer: ReturnType<typeof setInterval> | null = null;
let dailyTimer: ReturnType<typeof setInterval> | null = null;

export function startDigestWorker() {
  logger.info('Starting email digest worker');

  // Hourly digest
  hourlyTimer = setInterval(() => {
    processDigest('HOURLY');
    cleanupOldNotifications();
  }, HOURLY_INTERVAL);

  // Daily digest (run at the top of each day interval)
  dailyTimer = setInterval(() => {
    processDigest('DAILY');
  }, DAILY_INTERVAL);
}

export function stopDigestWorker() {
  if (hourlyTimer) clearInterval(hourlyTimer);
  if (dailyTimer) clearInterval(dailyTimer);
  hourlyTimer = null;
  dailyTimer = null;
}
