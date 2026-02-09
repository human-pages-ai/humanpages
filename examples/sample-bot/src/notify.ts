import { config } from './config.js';

/**
 * Owner notifications via Telegram.
 *
 * Optional — set OWNER_TELEGRAM_BOT_TOKEN and OWNER_TELEGRAM_CHAT_ID
 * to receive alerts when the bot needs attention:
 *
 *   - Job status changes (accepted, rejected, completed)
 *   - LLM errors (replies fell back to keywords)
 *   - Human messages that might need manual follow-up
 *
 * To get your chat ID:
 *   1. Message @userinfobot on Telegram
 *   2. It replies with your chat ID
 *
 * To create a bot token:
 *   1. Message @BotFather on Telegram
 *   2. Send /newbot and follow the prompts
 *   3. Copy the token it gives you
 */

const isConfigured = Boolean(config.ownerTelegramBotToken && config.ownerTelegramChatId);

export function isOwnerNotifyConfigured(): boolean {
  return isConfigured;
}

export async function notifyOwner(text: string): Promise<void> {
  if (!isConfigured) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.ownerTelegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.ownerTelegramChatId,
          text,
          parse_mode: 'HTML',
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.log(`  [Notify] Telegram error: ${res.status} ${err.slice(0, 100)}`);
    }
  } catch (err) {
    console.log(`  [Notify] Telegram failed: ${(err as Error).message}`);
  }
}

/** Shorthand for common events */
export const notify = {
  jobCreated: (jobId: string, humanName: string, price: number) =>
    notifyOwner(`📋 <b>Job offered</b>\nTo: ${esc(humanName)}\nPrice: $${price} USDC\nID: <code>${jobId}</code>`),

  jobAccepted: (jobId: string, humanName: string) =>
    notifyOwner(`✅ <b>Job accepted</b> by ${esc(humanName)}\nID: <code>${jobId}</code>`),

  jobRejected: (jobId: string, humanName: string) =>
    notifyOwner(`❌ <b>Job rejected</b> by ${esc(humanName)}\nID: <code>${jobId}</code>`),

  jobCompleted: (jobId: string, humanName: string) =>
    notifyOwner(`🎉 <b>Job completed</b> by ${esc(humanName)}\nID: <code>${jobId}</code>`),

  humanMessage: (jobId: string, humanName: string, content: string) =>
    notifyOwner(`💬 <b>${esc(humanName)}</b>:\n${esc(content.slice(0, 500))}\n\nJob: <code>${jobId}</code>`),

  llmError: (provider: string, error: string) =>
    notifyOwner(`⚠️ <b>LLM error</b> (${esc(provider)})\n${esc(error.slice(0, 300))}\nFalling back to keyword replies.`),

  botError: (error: string) =>
    notifyOwner(`🚨 <b>Bot error</b>\n${esc(error.slice(0, 500))}`),
};

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
