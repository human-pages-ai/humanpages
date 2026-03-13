/**
 * Watch Dog v2 — AI Error Monitor
 *
 * Near-realtime error detection via fs.watch + incremental file reading.
 * Features: cursor tracking (no duplicate processing), log rotation awareness,
 * error categorization, rate limiting, severity-based dispatch.
 * Zero external dependencies — reads PM2 logs from disk.
 */
import fs from 'fs/promises';
import { existsSync, statSync, openSync, readSync, closeSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { prisma } from './prisma.js';
import { sendTelegramMessage } from './telegram.js';
import { logger } from './logger.js';

// ── Types ──────────────────────────────────────────────────────────

export interface LogLine {
  level: number;
  time: number;
  msg?: string;
  message?: string;
  err?: { name?: string; type?: string; message?: string; stack?: string };
  [key: string]: any;
}

export interface ErrorGroup {
  fingerprint: string;
  errorType: string | null;
  message: string;
  level: number;
  count: number;
  category: ErrorCategory;
  samples: LogLine[];
  firstTime: string;
  lastTime: string;
}

export type ErrorCategory =
  | 'database'
  | 'auth'
  | 'timeout'
  | 'memory'
  | 'validation'
  | 'network'
  | 'unknown';

// ── Configuration ──────────────────────────────────────────────────

export const WATCHDOG_CONFIG = {
  // Batching
  BATCH_FLUSH_INTERVAL_MS: 30_000,
  BATCH_MAX_SIZE: 50,
  MAX_ERRORS_PER_RUN: 20,

  // Alerting
  ALERT_COOLDOWN_HOURS: 4,
  FATAL_COOLDOWN_HOURS: 2,

  // Rate limiting
  CLAUDE_BUDGET_PER_HOUR: 30,
  TELEGRAM_BUDGET_PER_HOUR: 20,

  // File I/O
  MAX_LOG_BYTES: 5 * 1024 * 1024,
  LOOKBACK_MINUTES: 10,

  // Claude
  CLAUDE_TIMEOUT_MS: 30_000,
  CLAUDE_MAX_TOKENS: 500,

  // Cursor persistence
  CURSOR_SAVE_INTERVAL_MS: 10_000,
};

// ── File Cursor Tracking ──────────────────────────────────────────

export interface FileCursor {
  path: string;
  inode: number;
  byteOffset: number;
  lastReadAt: number;
}

const cursors = new Map<string, FileCursor>();
let cursorDirty = false;

function getCursorFilePath(): string {
  const home = os.homedir();
  return path.join(home, '.pm2', 'logs', '.watchdog-cursors.json');
}

export function loadCursors(): void {
  try {
    const cursorPath = getCursorFilePath();
    if (!existsSync(cursorPath)) return;
    const data = JSON.parse(require('fs').readFileSync(cursorPath, 'utf-8'));
    if (Array.isArray(data)) {
      for (const c of data) {
        if (c.path && typeof c.inode === 'number' && typeof c.byteOffset === 'number') {
          cursors.set(c.path, c);
        }
      }
      logger.info({ count: cursors.size }, 'Watch Dog: Loaded file cursors from disk');
    }
  } catch {
    logger.debug('Watch Dog: No cursor file found or invalid, starting fresh');
  }
}

export function saveCursors(): void {
  if (!cursorDirty) return;
  try {
    const cursorPath = getCursorFilePath();
    const data = JSON.stringify(Array.from(cursors.values()), null, 2);
    require('fs').writeFileSync(cursorPath, data, 'utf-8');
    cursorDirty = false;
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Failed to save cursors');
  }
}

function getCursor(filePath: string): FileCursor {
  let cursor = cursors.get(filePath);
  if (!cursor) {
    cursor = { path: filePath, inode: 0, byteOffset: 0, lastReadAt: 0 };
    cursors.set(filePath, cursor);
  }
  return cursor;
}

function updateCursor(filePath: string, inode: number, byteOffset: number): void {
  const cursor = getCursor(filePath);
  cursor.inode = inode;
  cursor.byteOffset = byteOffset;
  cursor.lastReadAt = Date.now();
  cursorDirty = true;
}

// ── PM2 Log Paths ─────────────────────────────────────────────────

export function getLogPaths(): string[] {
  const home = os.homedir();
  const appName = process.env.PM2_APP_NAME || 'human-pages';
  const paths: string[] = [];

  const dirs = [path.join(home, '.pm2', 'logs')];
  if (process.env.PM2_LOG_DIR) dirs.push(process.env.PM2_LOG_DIR);

  for (const dir of dirs) {
    paths.push(
      path.join(dir, `${appName}-out.log`),
      path.join(dir, `${appName}-error.log`),
    );
  }

  return paths;
}

// ── Rate Limiting (in-memory) ─────────────────────────────────────

interface Budget {
  used: number;
  limit: number;
  resetAt: number;
}

const budgets = new Map<string, Budget>();

export function acquireQuota(service: 'claude' | 'telegram'): boolean {
  const now = Date.now();
  let budget = budgets.get(service);

  if (!budget || now > budget.resetAt) {
    const limit =
      service === 'claude'
        ? WATCHDOG_CONFIG.CLAUDE_BUDGET_PER_HOUR
        : WATCHDOG_CONFIG.TELEGRAM_BUDGET_PER_HOUR;
    budget = { used: 0, limit, resetAt: now + 3600_000 };
    budgets.set(service, budget);
  }

  if (budget.used < budget.limit) {
    budget.used++;
    return true;
  }

  return false;
}

export function getBudgetStatus(service: 'claude' | 'telegram'): { used: number; limit: number; resetAt: number } {
  const now = Date.now();
  const budget = budgets.get(service);
  if (!budget || now > budget.resetAt) {
    const limit =
      service === 'claude'
        ? WATCHDOG_CONFIG.CLAUDE_BUDGET_PER_HOUR
        : WATCHDOG_CONFIG.TELEGRAM_BUDGET_PER_HOUR;
    return { used: 0, limit, resetAt: now + 3600_000 };
  }
  return { ...budget };
}

// ── Fingerprinting ─────────────────────────────────────────────────

function normalizeMessage(msg: string): string {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/\/[\w./-]+\.(js|ts|mjs):\d+:\d+/g, '<FILE>')
    .replace(/\b\d{4,}\b/g, '<NUM>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>')
    .trim();
}

export function createFingerprint(errorType: string | null, message: string): string {
  const normalized = normalizeMessage(message);
  const input = `${errorType || 'unknown'}::${normalized}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ── Error Categorization ──────────────────────────────────────────

export function classifyError(msg: string, type: string): ErrorCategory {
  const lowerMsg = msg.toLowerCase();
  const lowerType = type.toLowerCase();

  if (
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('duplicate key') ||
    lowerMsg.includes('foreign key') ||
    lowerMsg.includes('deadlock') ||
    lowerType.includes('prisma') ||
    lowerMsg.includes('connection pool') ||
    lowerMsg.includes('prepared statement')
  ) {
    return 'database';
  }

  if (
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('econnaborted') ||
    lowerMsg.includes('request aborted')
  ) {
    return 'timeout';
  }

  if (
    lowerMsg.includes('out of memory') ||
    lowerMsg.includes('heap') ||
    lowerMsg.includes('allocation failed') ||
    lowerType.includes('rangeerror')
  ) {
    return 'memory';
  }

  if (
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('invalid token') ||
    lowerMsg.includes('jwt') ||
    lowerMsg.includes('forbidden') ||
    lowerMsg.includes('authentication')
  ) {
    return 'auth';
  }

  if (
    lowerMsg.includes('validation') ||
    lowerMsg.includes('required') ||
    lowerMsg.includes('invalid') ||
    lowerType.includes('validationerror') ||
    lowerType.includes('zod')
  ) {
    return 'validation';
  }

  if (
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('enetunreach') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('fetch failed')
  ) {
    return 'network';
  }

  return 'unknown';
}

const CATEGORY_EMOJI: Record<ErrorCategory, string> = {
  database: '\u{1F5C4}',
  auth: '\u{1F512}',
  timeout: '\u{23F1}',
  memory: '\u{1F4BE}',
  validation: '\u{26A0}',
  network: '\u{1F310}',
  unknown: '\u{2753}',
};

// ── Incremental Log Reading ───────────────────────────────────────

export async function readNewBytes(
  filePath: string,
): Promise<{ lines: string[]; errors: LogLine[] }> {
  if (!existsSync(filePath)) return { lines: [], errors: [] };

  const stat = statSync(filePath);
  const currentInode = stat.ino;
  const currentSize = stat.size;
  const cursor = getCursor(filePath);

  let linesToProcess: string[] = [];

  // Detect log rotation: inode changed
  if (cursor.inode !== 0 && cursor.inode !== currentInode) {
    logger.info(
      { filePath, oldInode: cursor.inode, newInode: currentInode },
      'Watch Dog: Log rotation detected',
    );

    for (const suffix of ['.1', '.2', '.3']) {
      const rotatedPath = filePath + suffix;
      if (existsSync(rotatedPath)) {
        try {
          const rotatedStat = statSync(rotatedPath);
          if (rotatedStat.ino === cursor.inode && cursor.byteOffset < rotatedStat.size) {
            const remaining = readBytesFrom(rotatedPath, cursor.byteOffset, rotatedStat.size);
            if (remaining) {
              const lines = remaining.split('\n').filter(Boolean);
              linesToProcess.push(...lines);
              logger.info(
                { rotatedPath, lines: lines.length },
                'Watch Dog: Read remaining lines from rotated log',
              );
            }
          }
        } catch {
          // Rotated file may be gone by now
        }
        break;
      }
    }

    updateCursor(filePath, currentInode, 0);
  }

  // Detect truncation
  if (currentSize < cursor.byteOffset) {
    logger.warn(
      { filePath, expectedOffset: cursor.byteOffset, actualSize: currentSize },
      'Watch Dog: File truncated, resetting cursor',
    );
    updateCursor(filePath, currentInode, 0);
  }

  // Read new bytes from current offset
  const offset = cursors.get(filePath)?.byteOffset || 0;
  if (currentSize > offset) {
    const newContent = readBytesFrom(filePath, offset, currentSize);
    if (newContent) {
      const lines = newContent.split('\n').filter(Boolean);
      linesToProcess.push(...lines);
    }
    updateCursor(filePath, currentInode, currentSize);
  } else if (cursor.inode === 0) {
    // First run: set cursor to end of file (don't process existing content)
    updateCursor(filePath, currentInode, currentSize);
  }

  // Parse lines into LogLine errors
  const errors: LogLine[] = [];
  for (const line of linesToProcess) {
    try {
      const parsed = JSON.parse(line) as LogLine;
      if (!parsed.level || parsed.level < 50) continue;
      const msg = parsed.msg || parsed.message || '';
      if (msg.startsWith('Watch Dog:') || msg.startsWith('Watch Dog ')) continue;
      errors.push(parsed);
    } catch {
      // Not valid JSON — skip
    }
  }

  return { lines: linesToProcess, errors };
}

function readBytesFrom(filePath: string, start: number, end: number): string | null {
  try {
    const size = end - start;
    if (size <= 0) return null;
    const buffer = Buffer.alloc(size);
    const fd = openSync(filePath, 'r');
    try {
      readSync(fd, buffer, 0, size, start);
    } finally {
      closeSync(fd);
    }
    let content = buffer.toString('utf-8');
    if (start > 0) {
      const firstNewline = content.indexOf('\n');
      if (firstNewline >= 0) {
        content = content.slice(firstNewline + 1);
      }
    }
    return content;
  } catch {
    return null;
  }
}

// ── Group Errors ──────────────────────────────────────────────────

export function groupErrors(logLines: LogLine[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  for (const line of logLines) {
    const errObj = line.err || {};
    const message = errObj.message || line.msg || line.message || '(unknown error)';
    const errorType = errObj.name || errObj.type || null;
    const level = line.level || 50;
    const time = line.time ? new Date(line.time).toISOString() : new Date().toISOString();
    const category = classifyError(message, errorType || '');

    const fingerprint = createFingerprint(errorType, message);

    const existing = groups.get(fingerprint);
    if (existing) {
      existing.count++;
      if (existing.samples.length < 3) existing.samples.push(line);
      if (time > existing.lastTime) existing.lastTime = time;
      if (time < existing.firstTime) existing.firstTime = time;
    } else {
      groups.set(fingerprint, {
        fingerprint,
        errorType,
        message,
        level,
        count: 1,
        category,
        samples: [line],
        firstTime: time,
        lastTime: time,
      });
    }
  }

  return Array.from(groups.values());
}

// ── Claude Analysis ────────────────────────────────────────────────

export async function analyzeWithClaude(group: ErrorGroup): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.debug('Watch Dog: No ANTHROPIC_API_KEY, skipping AI analysis');
    return null;
  }

  if (!acquireQuota('claude')) {
    logger.info('Watch Dog: Claude budget exhausted, skipping AI analysis');
    return null;
  }

  const prompt = `You are a senior backend engineer analyzing a production error.

Error Type: ${group.errorType || 'unknown'}
Error Message: ${group.message}
Category: ${group.category}
Occurrences: ${group.count}
Log Level: ${group.level >= 60 ? 'FATAL' : 'ERROR'}

Sample log entries (JSON):
${group.samples
  .slice(0, 2)
  .map((s) => JSON.stringify(s, null, 2))
  .join('\n---\n')
  .slice(0, 3000)}

Provide a concise analysis in this format:
1. ROOT CAUSE: One sentence explaining the likely root cause
2. SEVERITY: Critical / High / Medium / Low
3. SUGGESTED FIX: 1-3 concrete steps to fix this
4. IMMEDIATE ACTION: What to do right now (restart, rollback, nothing, etc.)

Be direct and actionable. No fluff.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WATCHDOG_CONFIG.CLAUDE_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: WATCHDOG_CONFIG.CLAUDE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, 'Watch Dog: Claude API error');
      return null;
    }

    const result = (await response.json()) as { content: Array<{ text: string }> };
    return result.content?.[0]?.text || null;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.error('Watch Dog: Claude API timed out');
    } else {
      logger.error({ err }, 'Watch Dog: Failed to call Claude API');
    }
    return null;
  }
}

// ── Telegram Alert ─────────────────────────────────────────────────

export function formatTelegramAlert(group: ErrorGroup, analysis: string | null): string {
  const levelEmoji = group.level >= 60 ? '\u{1F534}' : '\u{1F7E0}';
  const categoryEmoji = CATEGORY_EMOJI[group.category] || '';
  const tierLabel = group.level >= 60 ? '\u{1F6A8} CRITICAL' : '\u{26A0}\u{FE0F} ERROR';

  const header = `${levelEmoji} <b>${tierLabel}</b> ${categoryEmoji}`;
  const errorLine = `<b>${escapeHtml(group.errorType || 'Error')}:</b> ${escapeHtml(truncate(group.message, 200))}`;
  const countLine = `<b>Occurrences:</b> ${group.count}x`;
  const categoryLine = `<b>Category:</b> ${group.category}`;

  let msg = `${header}\n\n${errorLine}\n${countLine}\n${categoryLine}`;

  if (analysis) {
    msg += `\n\n<b>AI Analysis:</b>\n<pre>${escapeHtml(truncate(analysis, 700))}</pre>`;
  }

  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL;
  if (appUrl) {
    msg += `\n\n<a href="${appUrl}/admin/watchdog">View in Dashboard</a>`;
  }

  return msg;
}

function formatBatchTelegramAlert(groups: ErrorGroup[]): string {
  const header = `\u{1F4CB} <b>Watch Dog Batch Report</b> \u{2014} ${groups.length} new error(s)\n`;

  const lines = groups.slice(0, 10).map((g, i) => {
    const emoji = g.level >= 60 ? '\u{1F534}' : '\u{1F7E0}';
    const cat = CATEGORY_EMOJI[g.category] || '';
    return `${i + 1}. ${emoji}${cat} <b>${escapeHtml(g.errorType || 'Error')}</b>: ${escapeHtml(truncate(g.message, 100))} (${g.count}x)`;
  });

  let msg = header + lines.join('\n');

  if (groups.length > 10) {
    msg += `\n\n<i>...and ${groups.length - 10} more</i>`;
  }

  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL;
  if (appUrl) {
    msg += `\n\n<a href="${appUrl}/admin/watchdog">View all in Dashboard</a>`;
  }

  return msg;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ── Process Error Groups (shared by watcher + manual scan) ────────

export async function processErrorGroups(groups: ErrorGroup[]): Promise<{ newAlerts: number }> {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  let newAlerts = 0;

  for (const group of groups.slice(0, WATCHDOG_CONFIG.MAX_ERRORS_PER_RUN)) {
    try {
      const existing = await prisma.monitoredError.findUnique({
        where: { fingerprint: group.fingerprint },
      });

      if (existing) {
        await prisma.monitoredError.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: new Date(group.lastTime),
            occurrences: { increment: group.count },
            samplePayload: group.samples[0] as any,
          },
        });

        const cooldownMs =
          group.level >= 60
            ? WATCHDOG_CONFIG.FATAL_COOLDOWN_HOURS * 3600_000
            : WATCHDOG_CONFIG.ALERT_COOLDOWN_HOURS * 3600_000;

        if (
          existing.status === 'alerted' &&
          existing.alertedAt &&
          Date.now() - existing.alertedAt.getTime() < cooldownMs
        ) {
          continue;
        }

        if (['acknowledged', 'resolved', 'ignored'].includes(existing.status)) {
          continue;
        }
      }

      // AI analysis only for new fingerprints to save budget
      const analysis = !existing ? await analyzeWithClaude(group) : null;

      if (existing) {
        await prisma.monitoredError.update({
          where: { id: existing.id },
          data: {
            ...(analysis ? { aiAnalysis: analysis, aiAnalyzedAt: new Date() } : {}),
            status: 'alerted',
            alertedAt: new Date(),
          },
        });
      } else {
        await prisma.monitoredError.create({
          data: {
            fingerprint: group.fingerprint,
            level: group.level,
            errorType: group.errorType,
            message: group.message,
            firstSeenAt: new Date(group.firstTime),
            lastSeenAt: new Date(group.lastTime),
            occurrences: group.count,
            aiAnalysis: analysis,
            aiAnalyzedAt: analysis ? new Date() : undefined,
            status: 'alerted',
            alertedAt: new Date(),
            samplePayload: group.samples[0] as any,
          },
        });
      }

      // Telegram: FATAL gets individual alert, ERROR gets batched
      if (chatId && group.level >= 60 && acquireQuota('telegram')) {
        const alertText = formatTelegramAlert(group, analysis);
        await sendTelegramMessage({ chatId, text: alertText, parseMode: 'HTML' });
        newAlerts++;
      } else if (chatId && group.level < 60) {
        newAlerts++;
      }
    } catch (err) {
      logger.error({ err, fingerprint: group.fingerprint }, 'Watch Dog: Failed to process error group');
    }
  }

  return { newAlerts };
}

export async function sendBatchAlert(groups: ErrorGroup[]): Promise<void> {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId || groups.length === 0) return;

  if (!acquireQuota('telegram')) {
    logger.info('Watch Dog: Telegram budget exhausted, skipping batch alert');
    return;
  }

  const alertText = formatBatchTelegramAlert(groups);
  await sendTelegramMessage({ chatId, text: alertText, parseMode: 'HTML' });
}

// ── Manual Scan (used by API endpoint) ────────────────────────────

export async function runErrorMonitor(): Promise<void> {
  const startTime = Date.now();
  logger.info('Watch Dog: Starting manual error scan');

  try {
    const logPaths = getLogPaths();
    const lookbackMs = WATCHDOG_CONFIG.LOOKBACK_MINUTES * 60_000;
    const allErrors: LogLine[] = [];

    for (const logPath of logPaths) {
      if (!existsSync(logPath)) continue;
      const content = await readTail(logPath, WATCHDOG_CONFIG.MAX_LOG_BYTES);
      if (!content) continue;
      const errors = parseRecentErrors(content, lookbackMs);
      allErrors.push(...errors);
    }

    if (allErrors.length === 0) {
      logger.debug('Watch Dog: No errors found in manual scan');
      return;
    }

    const groups = groupErrors(allErrors);
    logger.info({ errorGroups: groups.length, rawErrors: allErrors.length }, 'Watch Dog: Manual scan grouped errors');

    const { newAlerts } = await processErrorGroups(groups);

    const nonFatal = groups.filter((g) => g.level < 60);
    if (nonFatal.length > 0) {
      await sendBatchAlert(nonFatal);
    }

    const elapsed = Date.now() - startTime;
    logger.info({ elapsed, groups: groups.length, newAlerts }, 'Watch Dog: Manual scan complete');
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Manual scan failed');
  }
}

// ── Legacy helpers for manual scan ────────────────────────────────

async function readTail(filePath: string, maxBytes: number): Promise<string> {
  try {
    const stat = statSync(filePath);
    if (stat.size === 0) return '';
    const fd = await fs.open(filePath, 'r');
    try {
      const readStart = Math.max(0, stat.size - maxBytes);
      const readSize = Math.min(stat.size, maxBytes);
      const buffer = Buffer.alloc(readSize);
      await fd.read(buffer, 0, readSize, readStart);
      let content = buffer.toString('utf-8');
      if (readStart > 0) {
        const firstNewline = content.indexOf('\n');
        if (firstNewline >= 0) content = content.slice(firstNewline + 1);
      }
      return content;
    } finally {
      await fd.close();
    }
  } catch {
    return '';
  }
}

function parseRecentErrors(content: string, lookbackMs: number): LogLine[] {
  const cutoff = Date.now() - lookbackMs;
  const errors: LogLine[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as LogLine;
      if (!parsed.level || parsed.level < 50) continue;
      if (parsed.time && parsed.time < cutoff) continue;
      const msg = parsed.msg || parsed.message || '';
      if (msg.startsWith('Watch Dog:') || msg.startsWith('Watch Dog ')) continue;
      errors.push(parsed);
    } catch {
      // Not valid JSON — skip
    }
  }
  return errors;
}

// ── Monitoring State (exported for health endpoint) ───────────────

let watchDogStartedAt: number | null = null;
let lastErrorDetectedAt: number | null = null;

export function setWatchDogStarted(): void {
  watchDogStartedAt = Date.now();
}

export function setLastErrorDetected(): void {
  lastErrorDetectedAt = Date.now();
}

export function getWatchDogHealth(): {
  active: boolean;
  filesWatched: number;
  lastErrorAt: string | null;
  claudeBudget: { used: number; limit: number };
  telegramBudget: { used: number; limit: number };
  uptimeMs: number;
  cursors: Array<{ path: string; byteOffset: number; lastReadAt: number }>;
} {
  const claude = getBudgetStatus('claude');
  const telegram = getBudgetStatus('telegram');

  return {
    active: watchDogStartedAt !== null,
    filesWatched: cursors.size,
    lastErrorAt: lastErrorDetectedAt ? new Date(lastErrorDetectedAt).toISOString() : null,
    claudeBudget: { used: claude.used, limit: claude.limit },
    telegramBudget: { used: telegram.used, limit: telegram.limit },
    uptimeMs: watchDogStartedAt ? Date.now() - watchDogStartedAt : 0,
    cursors: Array.from(cursors.values()).map((c) => ({
      path: c.path,
      byteOffset: c.byteOffset,
      lastReadAt: c.lastReadAt,
    })),
  };
}
