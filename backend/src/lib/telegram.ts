// Telegram Bot API integration for notifications
import { logger } from './logger.js';
import { writeToOutbox } from './email.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = 'https://api.telegram.org/bot';

// Retry config
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout on API calls

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

async function sendTelegramMessageOnce(options: SendMessageOptions): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.info('Telegram bot token not configured, skipping notification');
    return false;
  }

  // Abort after timeout to prevent hanging connections
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Telegram API timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  // Safe JSON parsing — Telegram might return non-JSON on 502/503
  let data: { ok: boolean; description?: string };
  try {
    data = await response.json() as { ok: boolean; description?: string };
  } catch {
    throw new Error(`Telegram API returned non-JSON response (status ${response.status})`);
  }

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  logger.info({ chatId: options.chatId }, 'Telegram message sent');
  return true;
}

export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await sendTelegramMessageOnce(options);
    } catch (err) {
      logger.warn({ err, attempt, chatId: options.chatId }, 'Telegram send attempt failed');
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  // All retries exhausted — persist to outbox
  if (BOT_TOKEN) {
    logger.info({ chatId: options.chatId }, 'Queuing telegram message to outbox after inline failure');
    await writeToOutbox('telegram', options.chatId, options).catch(err =>
      logger.error({ err }, 'Failed to write telegram message to outbox')
    );
  }
  return false;
}

interface JobOfferNotification {
  chatId: string;
  humanName: string;
  jobTitle: string;
  jobDescription: string;
  priceUsdc: number;
  agentName?: string;
  dashboardUrl: string;
}

export async function sendJobOfferTelegram(data: JobOfferNotification): Promise<boolean> {
  const message = `
<b>New Job Offer!</b>

<b>${escapeHtml(data.jobTitle)}</b>
${data.agentName ? `From: ${escapeHtml(data.agentName)}` : ''}
Price: <b>$${data.priceUsdc} USDC</b>

${escapeHtml(data.jobDescription.slice(0, 200))}${data.jobDescription.length > 200 ? '...' : ''}

<a href="${escapeHtmlAttr(data.dashboardUrl)}">View Offer</a>
`.trim();

  return sendTelegramMessage({
    chatId: data.chatId,
    text: message,
    parseMode: 'HTML',
  });
}

export async function sendJobOfferUpdatedTelegram(data: JobOfferNotification): Promise<boolean> {
  const message = `
<b>Updated Job Offer!</b>

<b>${escapeHtml(data.jobTitle)}</b>
${data.agentName ? `From: ${escapeHtml(data.agentName)}` : ''}
Price: <b>$${data.priceUsdc} USDC</b>

${escapeHtml(data.jobDescription.slice(0, 200))}${data.jobDescription.length > 200 ? '...' : ''}

<a href="${escapeHtmlAttr(data.dashboardUrl)}">Review Updated Offer</a>
`.trim();

  return sendTelegramMessage({
    chatId: data.chatId,
    text: message,
    parseMode: 'HTML',
  });
}

// Escape HTML special characters for Telegram message text
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Escape HTML attribute values (for href, src, etc.)
function escapeHtmlAttr(url: string): string {
  return url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Verify bot token is configured
export function isTelegramConfigured(): boolean {
  return !!BOT_TOKEN;
}

// Get webhook secret for verifying incoming Telegram requests
export function getTelegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || null;
}

// Get bot username for deep links
export function getTelegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}
