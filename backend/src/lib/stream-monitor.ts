import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { verifyFlow, calculateTotalStreamed, getFlowInfo } from './blockchain/superfluid.js';
import { Decimal } from '@prisma/client/runtime/library';
import { sendStreamFlowStoppedEmail } from './email.js';
import { sendTelegramMessage } from './telegram.js';
import { fireWebhook } from './webhook.js';

const MONITOR_INTERVAL_MS = 60 * 1000; // 60 seconds

// Grace periods for micro-transfer ticks
const GRACE_PERIODS: Record<string, number> = {
  HOURLY: 30 * 60 * 1000,   // 30 minutes
  DAILY: 6 * 60 * 60 * 1000, // 6 hours
  WEEKLY: 24 * 60 * 60 * 1000, // 1 day
};

// Interval durations in ms
const INTERVAL_DURATIONS: Record<string, number> = {
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
};

let monitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Process active Superfluid streams — create checkpoints, detect stopped flows
 */
export async function processSuperfluidStreams(): Promise<void> {
  const streams = await prisma.job.findMany({
    where: {
      status: 'STREAMING',
      streamMethod: 'SUPERFLUID',
      streamSenderAddress: { not: null },
      streamSuperToken: { not: null },
      streamNetwork: { not: null },
    },
    include: {
      human: {
        include: {
          wallets: { select: { address: true, network: true } },
        },
      },
    },
  });

  for (const job of streams) {
    try {
      // Find human's wallet on the stream network
      const human = job.human as any;
      const wallets = human.wallets || [];
      const receiverWallet = wallets.find(
        (w: any) => w.network.toLowerCase() === job.streamNetwork!.toLowerCase()
      ) || wallets[0];

      if (!receiverWallet) {
        logger.warn({ jobId: job.id }, 'No receiver wallet found for stream');
        continue;
      }

      const flowInfo = await getFlowInfo({
        network: job.streamNetwork!,
        superToken: job.streamSuperToken!,
        sender: job.streamSenderAddress!,
        receiver: receiverWallet.address,
      });

      const flowRate = flowInfo.flowRate;

      if (flowRate <= 0n) {
        // Flow has been deleted — auto-pause
        logger.info({ jobId: job.id }, 'Superfluid flow stopped, auto-pausing job');

        // Calculate final total
        const totalStreamed = job.streamFlowRate && flowInfo.lastUpdated > 0n
          ? calculateTotalStreamed(job.streamFlowRate, Number(flowInfo.lastUpdated))
          : (job.streamTotalPaid?.toNumber() || 0);

        // Create final checkpoint tick
        const tickCount = job.streamTickCount + 1;
        await prisma.streamTick.create({
          data: {
            jobId: job.id,
            tickNumber: tickCount,
            status: 'VERIFIED',
            expectedAt: new Date(),
            graceDeadline: new Date(),
            amount: new Decimal(totalStreamed),
            verifiedAt: new Date(),
          },
        });

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'PAUSED',
            streamPausedAt: new Date(),
            streamTickCount: tickCount,
            streamTotalPaid: new Decimal(totalStreamed),
          },
        });

        // Notify human
        const notifyEmail = human.contactEmail || human.email;
        if (notifyEmail && human.emailNotifications) {
          sendStreamFlowStoppedEmail({
            humanName: human.name,
            humanEmail: notifyEmail,
            humanId: human.id,
            jobTitle: job.title,
            totalPaid: totalStreamed,
            language: human.preferredLanguage,
          }).catch((err: any) => logger.error({ err }, 'Stream flow stopped email failed'));
        }

        if (human.telegramChatId && human.telegramNotifications) {
          sendTelegramMessage({
            chatId: human.telegramChatId,
            text: `<b>Payment Flow Stopped</b>\n\nThe payment flow for "${job.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" was stopped by the agent.\n\nTotal received: $${totalStreamed.toFixed(2)} USDC\n\nThe stream has been paused.`,
            parseMode: 'HTML',
          }).catch((err: any) => logger.error({ err }, 'Stream flow stopped telegram failed'));
        }

        // Fire webhook
        if (job.callbackUrl) {
          fireWebhook(
            { ...job, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
            'job.stream_flow_stopped',
            { totalPaid: totalStreamed },
          );
        }
      } else {
        // Flow is active — create checkpoint
        const totalStreamed = calculateTotalStreamed(
          flowRate.toString(),
          Number(flowInfo.lastUpdated),
        );

        const tickCount = job.streamTickCount + 1;

        // Update flow rate if it changed
        const currentFlowRate = flowRate.toString();
        const flowRateChanged = job.streamFlowRate !== currentFlowRate;

        await prisma.streamTick.create({
          data: {
            jobId: job.id,
            tickNumber: tickCount,
            status: 'VERIFIED',
            expectedAt: new Date(),
            graceDeadline: new Date(),
            amount: new Decimal(totalStreamed),
            verifiedAt: new Date(),
          },
        });

        await prisma.job.update({
          where: { id: job.id },
          data: {
            streamTickCount: tickCount,
            streamTotalPaid: new Decimal(totalStreamed),
            ...(flowRateChanged ? { streamFlowRate: currentFlowRate } : {}),
          },
        });

        if (flowRateChanged) {
          logger.info({ jobId: job.id, oldRate: job.streamFlowRate, newRate: currentFlowRate }, 'Flow rate changed');
        }

        // Check max ticks cap
        if (job.streamMaxTicks && tickCount >= job.streamMaxTicks) {
          logger.info({ jobId: job.id, tickCount }, 'Max ticks reached, completing stream');
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              streamEndedAt: new Date(),
              completedAt: new Date(),
            },
          });

          if (job.callbackUrl) {
            fireWebhook(
              { ...job, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret, status: 'COMPLETED' },
              'job.stream_stopped',
              { totalPaid: totalStreamed, reason: 'max_ticks_reached' },
            );
          }
        } else {
          // Fire checkpoint webhook
          if (job.callbackUrl) {
            fireWebhook(
              { ...job, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
              'job.stream_checkpoint',
              { tickNumber: tickCount, totalPaid: totalStreamed, flowRate: currentFlowRate },
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'Error processing Superfluid stream');
    }
  }
}

/**
 * Process active micro-transfer streams — check missed ticks, create new ticks
 */
export async function processMicroTransferStreams(): Promise<void> {
  const now = new Date();

  // 1. Find PENDING ticks past their grace deadline → mark MISSED
  const expiredTicks = await prisma.streamTick.findMany({
    where: {
      status: 'PENDING',
      graceDeadline: { lt: now },
      job: { status: 'STREAMING', streamMethod: 'MICRO_TRANSFER' },
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          streamMissedTicks: true,
          streamGraceTicks: true,
          callbackUrl: true,
          callbackSecret: true,
          humanId: true,
          status: true,
          priceUsdc: true,
          description: true,
          human: {
            select: {
              id: true,
              name: true,
              email: true,
              contactEmail: true,
              emailNotifications: true,
              telegramChatId: true,
              telegramNotifications: true,
            },
          },
        },
      },
    },
  });

  for (const tick of expiredTicks) {
    try {
      await prisma.streamTick.update({
        where: { id: tick.id },
        data: { status: 'MISSED' },
      });

      const newMissedCount = tick.job.streamMissedTicks + 1;
      await prisma.job.update({
        where: { id: tick.job.id },
        data: { streamMissedTicks: newMissedCount },
      });

      // Check if consecutive misses exceed grace threshold
      if (newMissedCount >= tick.job.streamGraceTicks) {
        logger.info({ jobId: tick.job.id, missedTicks: newMissedCount }, 'Auto-pausing stream due to missed ticks');

        await prisma.job.update({
          where: { id: tick.job.id },
          data: {
            status: 'PAUSED',
            streamPausedAt: new Date(),
          },
        });

        // Notify human
        const human = tick.job.human;
        if (human.telegramChatId && human.telegramNotifications) {
          sendTelegramMessage({
            chatId: human.telegramChatId,
            text: `<b>Stream Paused</b>\n\nThe stream payment for "${tick.job.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" was paused because ${newMissedCount} payment(s) were missed.`,
            parseMode: 'HTML',
          }).catch((err: any) => logger.error({ err }, 'Stream paused telegram failed'));
        }

        if (tick.job.callbackUrl) {
          fireWebhook(
            { ...tick.job, callbackUrl: tick.job.callbackUrl, callbackSecret: tick.job.callbackSecret } as any,
            'job.stream_paused',
            { reason: 'missed_ticks', missedCount: newMissedCount },
          );
        }
      }
    } catch (err) {
      logger.error({ err, tickId: tick.id }, 'Error processing missed tick');
    }
  }

  // 2. Create next PENDING tick for verified streams where interval has elapsed
  const activeStreams = await prisma.job.findMany({
    where: {
      status: 'STREAMING',
      streamMethod: 'MICRO_TRANSFER',
      streamInterval: { not: null },
    },
  });

  for (const job of activeStreams) {
    try {
      // Check if there's already a PENDING tick
      const pendingTick = await prisma.streamTick.findFirst({
        where: { jobId: job.id, status: 'PENDING' },
      });

      if (pendingTick) continue; // Already has a pending tick

      // Get the last verified tick
      const lastTick = await prisma.streamTick.findFirst({
        where: { jobId: job.id, status: 'VERIFIED' },
        orderBy: { tickNumber: 'desc' },
      });

      if (!lastTick) continue; // No verified ticks yet (first tick is created at start-stream)

      // Check if max ticks reached
      if (job.streamMaxTicks && job.streamTickCount >= job.streamMaxTicks) {
        logger.info({ jobId: job.id }, 'Max ticks reached for micro-transfer stream');
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            streamEndedAt: new Date(),
            completedAt: new Date(),
          },
        });
        continue;
      }

      // Check if enough time has elapsed since last tick
      const intervalMs = INTERVAL_DURATIONS[job.streamInterval!];
      const nextTickTime = new Date(lastTick.verifiedAt!.getTime() + intervalMs);

      if (now >= nextTickTime) {
        const graceMs = GRACE_PERIODS[job.streamInterval!] || intervalMs;
        const graceDeadline = new Date(nextTickTime.getTime() + graceMs);

        await prisma.streamTick.create({
          data: {
            jobId: job.id,
            tickNumber: job.streamTickCount + 1,
            status: 'PENDING',
            expectedAt: nextTickTime,
            graceDeadline,
          },
        });
      }
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'Error creating next micro-transfer tick');
    }
  }
}

/**
 * Main monitor loop — called every 60 seconds
 */
export async function runMonitor(): Promise<void> {
  try {
    await processSuperfluidStreams();
    await processMicroTransferStreams();
  } catch (err) {
    logger.error({ err }, 'Stream monitor error');
  }
}

export function startStreamMonitor(): void {
  logger.info('Starting stream payment monitor');
  monitorTimer = setInterval(runMonitor, MONITOR_INTERVAL_MS);
}

export function stopStreamMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
