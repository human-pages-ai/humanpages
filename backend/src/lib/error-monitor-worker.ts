/**
 * Watch Dog v2 Worker — Near-realtime error monitoring via fs.watch.
 *
 * Instead of polling every 5 minutes, watches PM2 log files for changes.
 * FATAL errors are processed immediately (< 5 sec).
 * Regular errors are batched every 30 seconds.
 * Falls back to 60s polling if fs.watch misses events.
 */
import { watch, FSWatcher, existsSync } from 'fs';
import {
  getLogPaths,
  readNewBytes,
  groupErrors,
  processErrorGroups,
  sendBatchAlert,
  loadCursors,
  saveCursors,
  setWatchDogStarted,
  setLastErrorDetected,
  WATCHDOG_CONFIG,
  type LogLine,
} from './error-monitor.js';
import { logger } from './logger.js';

// ── State ──────────────────────────────────────────────────────────

let watchers: FSWatcher[] = [];
let batchTimer: ReturnType<typeof setInterval> | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let cursorSaveTimer: ReturnType<typeof setInterval> | null = null;
let errorBuffer: LogLine[] = [];
let bufferFirstErrorAt: number | null = null;
let running = false;
let processing = false;

// ── Watcher Logic ──────────────────────────────────────────────────

async function onFileChange(filePath: string): Promise<void> {
  if (processing) return;

  try {
    const { errors } = await readNewBytes(filePath);
    if (errors.length === 0) return;

    setLastErrorDetected();

    const fatal: LogLine[] = [];
    const regular: LogLine[] = [];

    for (const err of errors) {
      if (err.level >= 60) {
        fatal.push(err);
      } else {
        regular.push(err);
      }
    }

    // FATAL errors: process immediately
    if (fatal.length > 0) {
      processing = true;
      try {
        const groups = groupErrors(fatal);
        logger.info(
          { count: fatal.length, groups: groups.length },
          'Watch Dog: FATAL error(s) detected — processing immediately',
        );
        await processErrorGroups(groups);
      } finally {
        processing = false;
      }
    }

    // Regular errors: add to buffer
    if (regular.length > 0) {
      errorBuffer.push(...regular);
      if (bufferFirstErrorAt === null) bufferFirstErrorAt = Date.now();

      if (errorBuffer.length >= WATCHDOG_CONFIG.BATCH_MAX_SIZE) {
        await flushBuffer();
      }
    }
  } catch (err) {
    logger.error({ err, filePath }, 'Watch Dog: Error processing file change');
  }
}

async function flushBuffer(): Promise<void> {
  if (errorBuffer.length === 0 || processing) return;

  const toProcess = [...errorBuffer];
  errorBuffer = [];
  bufferFirstErrorAt = null;

  processing = true;
  try {
    const groups = groupErrors(toProcess);
    if (groups.length === 0) return;

    logger.info(
      { rawErrors: toProcess.length, groups: groups.length },
      'Watch Dog: Flushing error buffer',
    );

    await processErrorGroups(groups);

    const nonFatal = groups.filter((g) => g.level < 60);
    if (nonFatal.length > 0) {
      await sendBatchAlert(nonFatal);
    }
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Failed to flush error buffer');
  } finally {
    processing = false;
  }
}

async function fallbackPoll(): Promise<void> {
  const logPaths = getLogPaths();
  for (const logPath of logPaths) {
    if (!existsSync(logPath)) continue;
    await onFileChange(logPath);
  }
}

// ── Start / Stop ──────────────────────────────────────────────────

export function startErrorMonitorWorker(): void {
  if (running) {
    logger.warn('Watch Dog worker already running');
    return;
  }
  running = true;

  loadCursors();

  const logPaths = getLogPaths();
  const existingPaths = logPaths.filter((p) => existsSync(p));

  if (existingPaths.length === 0) {
    logger.warn(
      { searchedPaths: logPaths },
      'Watch Dog: No PM2 log files found. Worker will start but retry via fallback polling.',
    );
  }

  for (const logPath of existingPaths) {
    try {
      const watcher = watch(logPath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          onFileChange(logPath).catch((err) =>
            logger.error({ err, logPath }, 'Watch Dog: Watcher callback error'),
          );
        }
      });

      watcher.on('error', (err) => {
        logger.error({ err, logPath }, 'Watch Dog: File watcher error');
      });

      watchers.push(watcher);
    } catch (err) {
      logger.error({ err, logPath }, 'Watch Dog: Failed to start watcher');
    }
  }

  // Batch flush timer: check every 5s if buffer is old enough to flush
  batchTimer = setInterval(() => {
    if (bufferFirstErrorAt !== null) {
      const age = Date.now() - bufferFirstErrorAt;
      if (age >= WATCHDOG_CONFIG.BATCH_FLUSH_INTERVAL_MS) {
        flushBuffer().catch((err) =>
          logger.error({ err }, 'Watch Dog: Batch flush timer error'),
        );
      }
    }
  }, 5_000);

  // Fallback poll: every 60s in case fs.watch missed events
  fallbackTimer = setInterval(() => {
    fallbackPoll().catch((err) =>
      logger.error({ err }, 'Watch Dog: Fallback poll error'),
    );
  }, 60_000);

  // Cursor save timer
  cursorSaveTimer = setInterval(() => {
    saveCursors();
  }, WATCHDOG_CONFIG.CURSOR_SAVE_INTERVAL_MS);

  setWatchDogStarted();

  logger.info(
    {
      filesWatched: existingPaths.length,
      logPaths: existingPaths,
      batchFlushMs: WATCHDOG_CONFIG.BATCH_FLUSH_INTERVAL_MS,
    },
    'Watch Dog v2 worker started (fs.watch + 60s fallback poll)',
  );
}

export function stopErrorMonitorWorker(): void {
  if (!running) return;
  running = false;

  for (const watcher of watchers) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  watchers = [];

  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  if (cursorSaveTimer) {
    clearInterval(cursorSaveTimer);
    cursorSaveTimer = null;
  }

  flushBuffer().catch(() => {});
  saveCursors();

  errorBuffer = [];
  bufferFirstErrorAt = null;

  logger.info('Watch Dog v2 worker stopped');
}
