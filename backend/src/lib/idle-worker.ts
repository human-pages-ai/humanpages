import { prisma } from './prisma.js';
import { broadcastSSE } from './sse-manager.js';
import { sendTelegramMessage } from './telegram.js';
import { logger } from './logger.js';

const IDLE_THRESHOLD_MINUTES = parseInt(process.env.IDLE_THRESHOLD_MINUTES || '15', 10);
const CHECK_INTERVAL_MS = 60_000; // 1 minute

let intervalId: ReturnType<typeof setInterval> | null = null;

async function checkIdleStaff(): Promise<void> {
  try {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() - IDLE_THRESHOLD_MINUTES * 60_000);

    // Find all clocked-in staff (open TimeEntry)
    const openEntries = await prisma.timeEntry.findMany({
      where: { clockOut: null },
      select: {
        humanId: true,
        clockIn: true,
        human: { select: { id: true, name: true, telegramChatId: true } },
      },
    });

    if (openEntries.length === 0) return;

    const clockedInIds = openEntries.map((e) => e.humanId);

    // Get most recent activity for each clocked-in staff
    const recentActivities = await prisma.$queryRaw<
      Array<{ humanId: string; lastActivity: Date }>
    >`
      SELECT "humanId", MAX("createdAt") as "lastActivity"
      FROM "StaffActivity"
      WHERE "humanId" = ANY(${clockedInIds})
      GROUP BY "humanId"
    `;

    const lastActivityMap = new Map(
      recentActivities.map((r) => [r.humanId, new Date(r.lastActivity)])
    );

    // Get existing active alerts
    const existingAlerts = await prisma.idleAlert.findMany({
      where: { humanId: { in: clockedInIds }, status: 'ACTIVE' },
      select: { id: true, humanId: true },
    });
    const alertedSet = new Set(existingAlerts.map((a) => a.humanId));

    for (const entry of openEntries) {
      const lastActivity = lastActivityMap.get(entry.humanId) ?? entry.clockIn;
      const idleMinutes = Math.round((now.getTime() - lastActivity.getTime()) / 60_000);

      if (idleMinutes >= IDLE_THRESHOLD_MINUTES && !alertedSet.has(entry.humanId)) {
        // Create new idle alert
        const alert = await prisma.idleAlert.create({
          data: {
            humanId: entry.humanId,
            idleSince: lastActivity,
            idleMinutes,
          },
        });

        broadcastSSE('idle_alert', {
          id: alert.id,
          humanId: entry.humanId,
          humanName: entry.human.name,
          idleSince: lastActivity.toISOString(),
          idleMinutes,
          createdAt: alert.createdAt.toISOString(),
        });

        // Send Telegram to admin(s)
        const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
        if (adminChatId) {
          sendTelegramMessage({
            chatId: adminChatId,
            text: `<b>Idle Alert</b>\n\n${entry.human.name} has been idle for <b>${idleMinutes} min</b> (clocked in since ${entry.clockIn.toISOString().slice(11, 16)} UTC).`,
            parseMode: 'HTML',
          }).catch(() => {});
        }

        logger.info(
          { humanId: entry.humanId, humanName: entry.human.name, idleMinutes },
          'Idle alert created'
        );
      } else if (idleMinutes >= IDLE_THRESHOLD_MINUTES && alertedSet.has(entry.humanId)) {
        // Update idle minutes on existing alert
        const existing = existingAlerts.find((a) => a.humanId === entry.humanId);
        if (existing) {
          await prisma.idleAlert.update({
            where: { id: existing.id },
            data: { idleMinutes },
          });
        }
      } else if (idleMinutes < IDLE_THRESHOLD_MINUTES && alertedSet.has(entry.humanId)) {
        // Auto-resolve: staff resumed activity
        await resolveIdleAlerts(entry.humanId);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Idle worker check failed');
  }
}

export async function resolveIdleAlerts(humanId: string): Promise<void> {
  const alerts = await prisma.idleAlert.findMany({
    where: { humanId, status: 'ACTIVE' },
    select: { id: true },
  });

  if (alerts.length === 0) return;

  await prisma.idleAlert.updateMany({
    where: { humanId, status: 'ACTIVE' },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });

  const human = await prisma.human.findUnique({
    where: { id: humanId },
    select: { name: true },
  });

  for (const alert of alerts) {
    broadcastSSE('idle_resolved', {
      id: alert.id,
      humanId,
      humanName: human?.name ?? 'Unknown',
      resolvedAt: new Date().toISOString(),
    });
  }

  logger.info({ humanId, alertCount: alerts.length }, 'Idle alerts resolved');
}

export function startIdleWorker(): void {
  if (intervalId) return;
  intervalId = setInterval(checkIdleStaff, CHECK_INTERVAL_MS);
  logger.info({ thresholdMinutes: IDLE_THRESHOLD_MINUTES }, 'Idle worker started');
}

export function stopIdleWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Idle worker stopped');
  }
}
