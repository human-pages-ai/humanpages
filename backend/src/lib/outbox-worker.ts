import { prisma } from './prisma.js';
import { logger } from './logger.js';

// How often the worker runs
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// Backoff schedule: attempt 1→30s, 2→2m, 3→10m, 4→1h, 5→give up
const BACKOFF_SCHEDULE_MS = [30_000, 120_000, 600_000, 3_600_000];
const MAX_ATTEMPTS = 5;

// Max age before we stop retrying and mark FAILED
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup sent/failed entries older than this
const CLEANUP_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let timer: ReturnType<typeof setInterval> | null = null;

async function sendEmailDirect(payload: any): Promise<boolean> {
  // Lazy import to avoid circular deps
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const from = `${process.env.FROM_NAME || 'HumanPages'} <${process.env.FROM_EMAIL || 'noreply@humanpages.ai'}>`;

  const { data: response, error } = await resend.emails.send({
    from,
    to: [payload.to],
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  if (error) {
    const errMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
    // Don't retry on auth errors — the key is invalid
    if (errMsg.includes('API key') || errMsg.includes('Unauthorized')) {
      logger.error({ err: errMsg }, 'Outbox email API key invalid — skipping');
      return false;
    }
    throw new Error(errMsg);
  }

  logger.info({ messageId: response?.id, provider: 'resend' }, 'Outbox email sent');
  return true;
}

async function sendTelegramDirect(payload: any): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: payload.chatId,
      text: payload.text,
      parse_mode: payload.parseMode || 'HTML',
    }),
  });

  const data = await response.json() as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  logger.info({ chatId: payload.chatId }, 'Outbox telegram message sent');
  return true;
}

async function processOutbox() {
  try {
    const now = new Date();

    const entries = await prisma.notificationOutbox.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: now },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const entry of entries) {
      // Skip entries that are too old
      if (now.getTime() - entry.createdAt.getTime() > MAX_AGE_MS) {
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: { status: 'FAILED', lastError: 'Exceeded max age (24h)' },
        });
        logger.warn({ id: entry.id, channel: entry.channel }, 'Outbox entry expired');
        continue;
      }

      try {
        const payload = entry.payload as any;
        if (entry.channel === 'email') {
          await sendEmailDirect(payload);
        } else if (entry.channel === 'telegram') {
          await sendTelegramDirect(payload);
        }

        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: { status: 'SENT', attempts: entry.attempts + 1 },
        });
      } catch (err) {
        const attempts = entry.attempts + 1;
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (attempts >= MAX_ATTEMPTS) {
          await prisma.notificationOutbox.update({
            where: { id: entry.id },
            data: { status: 'FAILED', attempts, lastError: errorMsg },
          });
          logger.error({ id: entry.id, channel: entry.channel, attempts }, 'Outbox entry permanently failed');
        } else {
          const backoffMs = BACKOFF_SCHEDULE_MS[Math.min(attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
          await prisma.notificationOutbox.update({
            where: { id: entry.id },
            data: {
              attempts,
              lastError: errorMsg,
              nextRetryAt: new Date(Date.now() + backoffMs),
            },
          });
          logger.warn({ id: entry.id, channel: entry.channel, attempts, nextRetryMs: backoffMs }, 'Outbox entry will retry');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Outbox worker processing failed');
  }
}

async function cleanupOutbox() {
  try {
    const cutoff = new Date(Date.now() - CLEANUP_AGE_MS);
    const { count } = await prisma.notificationOutbox.deleteMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
    });
    if (count > 0) {
      logger.info({ count }, 'Cleaned up old outbox entries');
    }
  } catch (err) {
    logger.error({ err }, 'Outbox cleanup failed');
  }
}

export function startOutboxWorker() {
  logger.info('Starting notification outbox worker');
  timer = setInterval(() => {
    processOutbox();
    cleanupOutbox();
  }, POLL_INTERVAL_MS);

  // Run once immediately on startup to flush any pending entries
  processOutbox();
}

export function stopOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
