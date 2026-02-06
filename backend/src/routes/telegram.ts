import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isTelegramConfigured, getTelegramBotUsername, sendTelegramMessage } from '../lib/telegram.js';

const router = Router();

// Store pending verification codes (in production, use Redis with TTL)
const pendingCodes = new Map<string, { oderId: string; expiresAt: number }>();

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (data.expiresAt < now) {
      pendingCodes.delete(code);
    }
  }
}, 60000); // Every minute

// Get Telegram connection status and link URL
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { telegramChatId: true, telegram: true },
    });

    const botUsername = getTelegramBotUsername();
    const isConfigured = isTelegramConfigured();

    res.json({
      connected: !!human?.telegramChatId,
      telegramUsername: human?.telegram,
      botAvailable: isConfigured && !!botUsername,
      botUsername,
    });
  } catch (error) {
    console.error('Telegram status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate a verification code for linking
router.post('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const botUsername = getTelegramBotUsername();
    if (!isTelegramConfigured() || !botUsername) {
      return res.status(400).json({ error: 'Telegram bot not configured' });
    }

    // Generate a unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Store with 10 minute expiry
    pendingCodes.set(code, {
      oderId: req.userId!,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Deep link to bot with code
    const linkUrl = `https://t.me/${botUsername}?start=${code}`;

    res.json({
      code,
      linkUrl,
      expiresIn: '10 minutes',
    });
  } catch (error) {
    console.error('Telegram link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Disconnect Telegram
router.delete('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: { telegramChatId: null },
    });

    res.json({ message: 'Telegram disconnected' });
  } catch (error) {
    console.error('Telegram disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook endpoint for Telegram bot updates
// Set this as webhook URL: https://yourapi.com/api/telegram/webhook
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    // Handle /start command with verification code
    if (update.message?.text?.startsWith('/start ')) {
      const code = update.message.text.replace('/start ', '').trim();
      const chatId = String(update.message.chat.id);
      const username = update.message.from?.username;

      const pending = pendingCodes.get(code);

      if (!pending) {
        await sendTelegramMessage({
          chatId,
          text: 'Invalid or expired code. Please generate a new link from your Humans dashboard.',
        });
        return res.json({ ok: true });
      }

      if (pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
        await sendTelegramMessage({
          chatId,
          text: 'This code has expired. Please generate a new link from your Humans dashboard.',
        });
        return res.json({ ok: true });
      }

      // Link the account
      await prisma.human.update({
        where: { id: pending.oderId },
        data: {
          telegramChatId: chatId,
          telegram: username ? `@${username}` : undefined,
        },
      });

      pendingCodes.delete(code);

      await sendTelegramMessage({
        chatId,
        text: `Your Telegram is now connected to Humans! You'll receive notifications here when you get new job offers.`,
      });

      console.log(`[Telegram] Linked chat ${chatId} to user ${pending.oderId}`);
    }

    // Handle plain /start (no code)
    else if (update.message?.text === '/start') {
      const chatId = String(update.message.chat.id);
      await sendTelegramMessage({
        chatId,
        text: `Welcome to Humans Bot!\n\nTo connect your account, go to your Humans dashboard and click "Connect Telegram" to get a verification link.`,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.json({ ok: true }); // Always return 200 to Telegram
  }
});

// Export pending codes for verification (used by other modules)
export function verifyTelegramCode(code: string): string | null {
  const pending = pendingCodes.get(code);
  if (!pending || pending.expiresAt < Date.now()) {
    return null;
  }
  return pending.oderId;
}

export default router;
