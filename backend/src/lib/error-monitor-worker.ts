/**
 * Watch Dog Worker — Runs error monitor on a fixed interval.
 * Follows the same pattern as idle-worker.ts.
 */
import { runErrorMonitor } from './error-monitor.js';
import { logger } from './logger.js';

const CHECK_INTERVAL_MS = 5 * 60_000; // 5 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startErrorMonitorWorker(): void {
  if (intervalId) {
    logger.warn('Watch Dog worker already running');
    return;
  }

  logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Watch Dog worker started (reads PM2 logs from disk)');

  // Run first check after a short delay (let server finish starting)
  setTimeout(() => {
    runErrorMonitor().catch((err) => {
      logger.error({ err }, 'Watch Dog: Initial run failed');
    });
  }, 30_000);

  // Then run on interval
  intervalId = setInterval(() => {
    runErrorMonitor().catch((err) => {
      logger.error({ err }, 'Watch Dog: Scheduled run failed');
    });
  }, CHECK_INTERVAL_MS);
}

export function stopErrorMonitorWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Watch Dog worker stopped');
  }
}
