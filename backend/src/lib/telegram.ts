// Telegram Bot API integration for notifications

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = 'https://api.telegram.org/bot';

interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.log('[Telegram] Bot token not configured, skipping notification');
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
      console.error('[Telegram] Failed to send message:', data.description);
      return false;
    }

    console.log('[Telegram] Message sent to chat:', options.chatId);
    return true;
  } catch (error) {
    console.error('[Telegram] Error sending message:', error);
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

// Generate a verification code for linking Telegram
export function generateTelegramCode(userId: string): string {
  // Simple code: base64 of oderId + timestamp, truncated
  const data = `${userId}:${Date.now()}`;
  return Buffer.from(data).toString('base64').slice(0, 12);
}

// Verify bot token is configured
export function isTelegramConfigured(): boolean {
  return !!BOT_TOKEN;
}

// Get bot username for deep links
export function getTelegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}
