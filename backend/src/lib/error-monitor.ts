/**
 * Watch Dog — AI Error Monitor
 *
 * Periodically queries Axiom for new errors, fingerprints them,
 * asks Claude to analyze root causes, and sends Telegram alerts.
 */
import { Axiom } from '@axiomhq/js';
import crypto from 'crypto';
import { prisma } from './prisma.js';
import { sendTelegramMessage } from './telegram.js';
import { logger } from './logger.js';

// ── Types ──────────────────────────────────────────────────────────

interface AxiomMatch {
  _time?: string;
  data?: Record<string, any>;
}

interface ErrorGroup {
  fingerprint: string;
  errorType: string | null;
  message: string;
  level: number;
  count: number;
  sample: Record<string, any>;
  firstTime: string;
  lastTime: string;
}

// ── Configuration ──────────────────────────────────────────────────

const LOOKBACK_MINUTES = 10; // overlap by 2× the check interval to avoid gaps
const MAX_ERRORS_PER_RUN = 20; // cap to avoid runaway costs
const ALERT_COOLDOWN_HOURS = 4; // don't re-alert same fingerprint within this window

// ── Fingerprinting ─────────────────────────────────────────────────

/**
 * Normalize an error message by stripping variable parts:
 * UUIDs, numbers, timestamps, file paths, etc.
 */
function normalizeMessage(msg: string): string {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>') // UUIDs
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>') // timestamps
    .replace(/\/[\w./-]+\.(js|ts|mjs):\d+:\d+/g, '<FILE>') // file:line:col
    .replace(/\b\d{4,}\b/g, '<NUM>') // long numbers (IDs, ports)
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>') // hex values
    .trim();
}

function createFingerprint(errorType: string | null, message: string): string {
  const normalized = normalizeMessage(message);
  const input = `${errorType || 'unknown'}::${normalized}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ── Axiom Query ────────────────────────────────────────────────────

function getAxiomClient(): Axiom | null {
  const token = process.env.AXIOM_TOKEN;
  if (!token) return null;
  return new Axiom({ token });
}

/**
 * Query Axiom for recent errors (level >= 50)
 */
async function fetchRecentErrors(): Promise<AxiomMatch[]> {
  const axiom = getAxiomClient();
  if (!axiom) return [];

  const dataset = process.env.AXIOM_DATASET;
  if (!dataset) return [];

  const apl = `['${dataset}'] | where _time > ago(${LOOKBACK_MINUTES}m) | where level >= 50 | sort by _time desc | take 200`;

  try {
    const result = await axiom.query(apl);
    return (result.matches || []) as AxiomMatch[];
  } catch (err) {
    logger.error({ err }, 'Watch Dog: Failed to query Axiom');
    return [];
  }
}

// ── Group Errors ───────────────────────────────────────────────────

function groupErrors(matches: AxiomMatch[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  for (const match of matches) {
    const data = match.data || {};
    const errObj = data.err || {};
    const message = errObj.message || data.msg || data.message || '(unknown error)';
    const errorType = errObj.name || errObj.type || null;
    const level = data.level || 50;
    const time = match._time || data._time || new Date().toISOString();

    const fingerprint = createFingerprint(errorType, message);

    const existing = groups.get(fingerprint);
    if (existing) {
      existing.count++;
      if (time > existing.lastTime) {
        existing.lastTime = time;
        existing.sample = data; // keep newest sample
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
        sample: data,
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
    // 1. Fetch recent errors from Axiom
    const matches = await fetchRecentErrors();
    if (matches.length === 0) {
      logger.debug('Watch Dog: No errors found');
      return;
    }

    // 2. Group by fingerprint
    const groups = groupErrors(matches);
    logger.info({ errorGroups: groups.length, rawErrors: matches.length }, 'Watch Dog: Errors grouped');

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
          // Update existing record with new analysis
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
          // Create new tracked error
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
