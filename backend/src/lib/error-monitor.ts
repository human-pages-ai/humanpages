/**
 * Watch Dog — AI Error Monitor
 *
 * Reads PM2 log files directly from disk, parses pino JSON lines,
 * fingerprints errors, asks Claude to analyze root causes, and
 * sends Telegram alerts. Zero external dependencies — no Axiom needed.
 */
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { prisma } from './prisma.js';
import { sendTelegramMessage } from './telegram.js';
import { logger } from './logger.js';

// ── Types ──────────────────────────────────────────────────────────

interface LogLine {
  level: number;
  time: number;
  msg?: string;
  message?: string;
  err?: { name?: string; type?: string; message?: string; stack?: string };
  [key: string]: any;
}

interface ErrorGroup {
  fingerprint: string;
  errorType: string | null;
  message: string;
  level: number;
  count: number;
  sample: LogLine;
  firstTime: string;
  lastTime: string;
}

// ── Configuration ──────────────────────────────────────────────────

const LOOKBACK_MINUTES = 10;
const MAX_ERRORS_PER_RUN = 20;
const ALERT_COOLDOWN_HOURS = 4;
const MAX_LOG_BYTES = 5 * 1024 * 1024; // Read last 5MB of log file

// PM2 log paths — check common locations
function getLogPaths(): string[] {
  const home = os.homedir();
  const appName = process.env.PM2_APP_NAME || 'human-pages';
  return [
    // PM2 default locations
    path.join(home, '.pm2', 'logs', `${appName}-out.log`),
    path.join(home, '.pm2', 'logs', `${appName}-error.log`),
    // Custom log dir if set
    ...(process.env.PM2_LOG_DIR ? [
      path.join(process.env.PM2_LOG_DIR, `${appName}-out.log`),
      path.join(process.env.PM2_LOG_DIR, `${appName}-error.log`),
    ] : []),
  ];
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

function createFingerprint(errorType: string | null, message: string): string {
  const normalized = normalizeMessage(message);
  const input = `${errorType || 'unknown'}::${normalized}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ── Log File Reading ───────────────────────────────────────────────

/**
 * Read the tail of a file (last N bytes) efficiently.
 */
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

      // If we started mid-file, skip the first partial line
      if (readStart > 0) {
        const firstNewline = content.indexOf('\n');
        if (firstNewline >= 0) {
          content = content.slice(firstNewline + 1);
        }
      }

      return content;
    } finally {
      await fd.close();
    }
  } catch {
    return '';
  }
}

/**
 * Parse pino JSON log lines, filter to errors from the last N minutes.
 */
function parseRecentErrors(content: string, lookbackMs: number): LogLine[] {
  const cutoff = Date.now() - lookbackMs;
  const errors: LogLine[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line) as LogLine;

      // Skip non-error lines (pino: 50=error, 60=fatal)
      if (!parsed.level || parsed.level < 50) continue;

      // Skip old entries
      if (parsed.time && parsed.time < cutoff) continue;

      // Skip Watch Dog's own log lines to avoid infinite loops
      const msg = parsed.msg || parsed.message || '';
      if (msg.startsWith('Watch Dog:')) continue;

      errors.push(parsed);
    } catch {
      // Not valid JSON — skip (could be a raw stderr line)
    }
  }

  return errors;
}

/**
 * Fetch recent errors from PM2 log files.
 */
async function fetchRecentErrors(): Promise<LogLine[]> {
  const logPaths = getLogPaths();
  const lookbackMs = LOOKBACK_MINUTES * 60_000;
  const allErrors: LogLine[] = [];

  for (const logPath of logPaths) {
    if (!existsSync(logPath)) continue;

    const content = await readTail(logPath, MAX_LOG_BYTES);
    if (!content) continue;

    const errors = parseRecentErrors(content, lookbackMs);
    allErrors.push(...errors);

    if (errors.length > 0) {
      logger.debug({ logPath, errorCount: errors.length }, 'Watch Dog: Errors found in log file');
    }
  }

  return allErrors;
}

// ── Group Errors ───────────────────────────────────────────────────

function groupErrors(logLines: LogLine[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  for (const line of logLines) {
    const errObj = line.err || {};
    const message = errObj.message || line.msg || line.message || '(unknown error)';
    const errorType = errObj.name || errObj.type || null;
    const level = line.level || 50;
    const time = line.time ? new Date(line.time).toISOString() : new Date().toISOString();

    const fingerprint = createFingerprint(errorType, message);

    const existing = groups.get(fingerprint);
    if (existing) {
      existing.count++;
      if (time > existing.lastTime) {
        existing.lastTime = time;
        existing.sample = line;
      }
      if (time < existing.firstTime) {
        existing.firstTime = time;
      }
    } else {
      groups.set(fingerprint, {
        fingerprint,
        errorType,
        message,
        level,
        count: 1,
        sample: line,
        firstTime: time,
        lastTime: time,
      });
    }
  }

  return Array.from(groups.values());
}

// ── Claude Analysis ────────────────────────────────────────────────

async function analyzeWithClaude(group: ErrorGroup): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.debug('Watch Dog: No ANTHROPIC_API_KEY, skipping AI analysis');
    return null;
  }

  const prompt = `You are a senior backend engineer analyzing a production error.

Error Type: ${group.errorType || 'unknown'}
Error Message: ${group.message}
Occurrences in last ${LOOKBACK_MINUTES} minutes: ${group.count}
Log Level: ${group.level === 60 ? 'FATAL' : 'ERROR'}

Sample log entry (JSON):
${JSON.stringify(group.sample, null, 2).slice(0, 3000)}

Provide a concise analysis in this format:
1. ROOT CAUSE: One sentence explaining the likely root cause
2. SEVERITY: Critical / High / Medium / Low
3. SUGGESTED FIX: 1-3 concrete steps to fix this
4. IMMEDIATE ACTION: What to do right now (restart, rollback, nothing, etc.)

Be direct and actionable. No fluff.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, 'Watch Dog: Claude API error');
      return null;
    }

    const result = (await response.json()) as { content: Array<{ text: string }> };
    return result.content?.[0]?.text || null;
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Failed to call Claude API');
    return null;
  }
}

// ── Telegram Alert ─────────────────────────────────────────────────

function formatTelegramAlert(group: ErrorGroup, analysis: string | null): string {
  const levelEmoji = group.level >= 60 ? '🔴' : '🟠';
  const header = `${levelEmoji} <b>Watch Dog Alert</b>`;
  const errorLine = `<b>Error:</b> ${escapeHtml(group.errorType || 'Error')}: ${escapeHtml(truncate(group.message, 200))}`;
  const countLine = `<b>Occurrences:</b> ${group.count}x in last ${LOOKBACK_MINUTES} min`;

  let msg = `${header}\n\n${errorLine}\n${countLine}`;

  if (analysis) {
    msg += `\n\n<b>AI Analysis:</b>\n<pre>${escapeHtml(truncate(analysis, 800))}</pre>`;
  }

  return msg;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ── Main Run ───────────────────────────────────────────────────────

export async function runErrorMonitor(): Promise<void> {
  const startTime = Date.now();
  logger.info('Watch Dog: Starting error scan');

  try {
    // 1. Fetch recent errors from PM2 log files
    const errors = await fetchRecentErrors();
    if (errors.length === 0) {
      logger.debug('Watch Dog: No errors found');
      return;
    }

    // 2. Group by fingerprint
    const groups = groupErrors(errors);
    logger.info({ errorGroups: groups.length, rawErrors: errors.length }, 'Watch Dog: Errors grouped');

    // 3. Process each group (up to cap)
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    let newAlerts = 0;

    for (const group of groups.slice(0, MAX_ERRORS_PER_RUN)) {
      try {
        // Check if we've already tracked this fingerprint
        const existing = await prisma.monitoredError.findUnique({
          where: { fingerprint: group.fingerprint },
        });

        if (existing) {
          // Update occurrence count and last seen
          await prisma.monitoredError.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(group.lastTime),
              occurrences: { increment: group.count },
              samplePayload: group.sample as any,
            },
          });

          // Check cooldown: skip re-alert if recently alerted
          if (
            existing.status === 'alerted' &&
            existing.alertedAt &&
            Date.now() - existing.alertedAt.getTime() < ALERT_COOLDOWN_HOURS * 3600_000
          ) {
            continue;
          }

          // Skip if manually acknowledged/resolved/ignored
          if (['acknowledged', 'resolved', 'ignored'].includes(existing.status)) {
            continue;
          }
        }

        // 4. AI analysis (only for new or re-surfacing errors)
        const analysis = await analyzeWithClaude(group);

        if (existing) {
          await prisma.monitoredError.update({
            where: { id: existing.id },
            data: {
              aiAnalysis: analysis,
              aiAnalyzedAt: new Date(),
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
              samplePayload: group.sample as any,
            },
          });
        }

        // 5. Send Telegram alert
        if (chatId) {
          const alertText = formatTelegramAlert(group, analysis);
          await sendTelegramMessage({ chatId, text: alertText, parseMode: 'HTML' });
          newAlerts++;
        }
      } catch (err) {
        logger.error({ err, fingerprint: group.fingerprint }, 'Watch Dog: Failed to process error group');
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(
      { elapsed, groups: groups.length, newAlerts },
      'Watch Dog: Scan complete'
    );
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Scan failed');
  }
}
