import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, cleanDatabase, authRequest } from './helpers.js';
import { prisma } from '../lib/prisma.js';

// Mock the telegram module
vi.mock('../lib/telegram.js', () => ({
  isTelegramConfigured: vi.fn(() => true),
  getTelegramBotUsername: vi.fn(() => 'test_bot'),
  getTelegramWebhookSecret: vi.fn(() => 'webhook-secret'),
  sendTelegramMessage: vi.fn(() => Promise.resolve()),
  sendJobOfferTelegram: vi.fn(() => Promise.resolve()),
}));

import {
  isTelegramConfigured,
  getTelegramBotUsername,
  getTelegramWebhookSecret,
  sendTelegramMessage,
} from '../lib/telegram.js';

const mockIsTelegramConfigured = vi.mocked(isTelegramConfigured);
const mockGetTelegramBotUsername = vi.mocked(getTelegramBotUsername);
const mockGetTelegramWebhookSecret = vi.mocked(getTelegramWebhookSecret);
const mockSendTelegramMessage = vi.mocked(sendTelegramMessage);

describe('Telegram API', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    mockIsTelegramConfigured.mockReturnValue(true);
    mockGetTelegramBotUsername.mockReturnValue('test_bot');
    mockGetTelegramWebhookSecret.mockReturnValue('webhook-secret');
    mockSendTelegramMessage.mockResolvedValue(undefined as any);
  });

  describe('GET /api/telegram/status', () => {
    it('should return status for connected user', async () => {
      const user = await createTestUser();
      await prisma.human.update({
        where: { id: user.id },
        data: { telegramChatId: '12345' },
      });

      const res = await authRequest(user.token).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.botAvailable).toBe(true);
    });

    it('should return status for disconnected user', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it('should return botAvailable based on config', async () => {
      const user = await createTestUser();
      mockIsTelegramConfigured.mockReturnValue(false);

      const res = await authRequest(user.token).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body.botAvailable).toBe(false);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/telegram/status');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/telegram/link', () => {
    it('should generate verification code and link URL', async () => {
      const user = await createTestUser();

      const res = await authRequest(user.token).post('/api/telegram/link');
      expect(res.status).toBe(200);
      expect(res.body.code).toBeDefined();
      expect(res.body.linkUrl).toContain('https://t.me/test_bot?start=');
      expect(res.body.expiresIn).toBe('10 minutes');
    });

    it('should return 400 if bot not configured', async () => {
      const user = await createTestUser();
      mockIsTelegramConfigured.mockReturnValue(false);
      mockGetTelegramBotUsername.mockReturnValue('');

      const res = await authRequest(user.token).post('/api/telegram/link');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Telegram bot not configured');
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/telegram/link');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/telegram/link', () => {
    it('should disconnect telegram', async () => {
      const user = await createTestUser();
      await prisma.human.update({
        where: { id: user.id },
        data: { telegramChatId: '12345' },
      });

      const res = await authRequest(user.token).delete('/api/telegram/link');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Telegram disconnected');

      // Verify it's actually disconnected
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.telegramChatId).toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app).delete('/api/telegram/link');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/telegram/webhook', () => {
    it('should link account with valid /start code', async () => {
      const user = await createTestUser();

      // Generate a code first
      const linkRes = await authRequest(user.token).post('/api/telegram/link');
      const code = linkRes.body.code;

      // Simulate webhook from Telegram
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'webhook-secret')
        .send({
          message: {
            text: `/start ${code}`,
            chat: { id: 67890 },
            from: { username: 'testuser' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verify account was linked
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human?.telegramChatId).toBe('67890');
      expect(human?.telegram).toBe('@testuser');
    });

    it('should send error message for invalid code', async () => {
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'webhook-secret')
        .send({
          message: {
            text: '/start INVALIDCODE',
            chat: { id: 67890 },
            from: { username: 'testuser' },
          },
        });

      expect(res.status).toBe(200);
      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: '67890',
          text: expect.stringContaining('Invalid or expired'),
        })
      );
    });

    it('should send welcome message for plain /start', async () => {
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'webhook-secret')
        .send({
          message: {
            text: '/start',
            chat: { id: 67890 },
            from: { username: 'testuser' },
          },
        });

      expect(res.status).toBe(200);
      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: '67890',
          text: expect.stringContaining('Welcome'),
        })
      );
    });

    it('should return 403 for invalid webhook secret', async () => {
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({
          message: {
            text: '/start',
            chat: { id: 67890 },
          },
        });

      expect(res.status).toBe(403);
    });

    it('should always return 200 to Telegram even on processing errors', async () => {
      // Send a message without text (edge case)
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'webhook-secret')
        .send({
          message: {
            chat: { id: 67890 },
          },
        });

      expect(res.status).toBe(200);
    });
  });
});
