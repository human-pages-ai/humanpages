// Telegram Bot API integration for notifications
import { logger } from './logger.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = 'https://api.telegram.org/bot';

interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.info('Telegram bot token not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
      }),
    });

    const data = await response.json() as { ok: boolean; description?: string };

    if (!data.ok) {
      logger.error({ description: data.description }, 'Telegram failed to send message');
      return false;
    }

    logger.info({ chatId: options.chatId }, 'Telegram message sent');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Telegram error sending message');
    return false;
  }
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

<a href="${data.dashboardUrl}">View Offer</a>
`.trim();

  return sendTelegramMessage({
    chatId: data.chatId,
    text: message,
    parseMode: 'HTML',
  });
}

// Escape HTML special characters for Telegram
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
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
