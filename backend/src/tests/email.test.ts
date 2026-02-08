import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Use vi.hoisted so the mock function is available when vi.mock factory runs (hoisted above imports)
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

// Import after mocking
import {
  generateUnsubscribeUrl,
  sendJobOfferEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
} from '../lib/email.js';

describe('Email Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.FROM_EMAIL = 'test@humanpages.ai';
    process.env.FROM_NAME = 'HumanPages';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('generateUnsubscribeUrl', () => {
    it('should return valid URL with JWT containing userId and action', () => {
      const url = generateUnsubscribeUrl('user-123');

      expect(url).toContain('http://localhost:3000');
      expect(url).toContain('/api/auth/unsubscribe?token=');

      // Extract and decode the token
      const token = url.split('token=')[1];
      const payload = jwt.verify(token, 'test-jwt-secret') as { userId: string; action: string };
      expect(payload.userId).toBe('user-123');
      expect(payload.action).toBe('unsubscribe');
    });
  });

  describe('sendJobOfferEmail', () => {
    const jobOfferData = {
      humanName: 'Test User',
      humanEmail: 'test@example.com',
      humanId: 'user-123',
      jobTitle: 'Fix my website',
      jobDescription: 'Need help with CSS bugs',
      priceUsdc: 50,
      agentName: 'AI Agent',
      category: 'Web Development',
      language: 'en',
    };

    it('should send email via Resend when API key is configured', async () => {
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend.mockResolvedValueOnce({ data: { id: 'msg-123' }, error: null });

      const result = await sendJobOfferEmail(jobOfferData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toEqual(['test@example.com']);
      expect(callArgs.from).toContain('HumanPages');
      expect(callArgs.subject).toBeDefined();
      expect(callArgs.text).toContain('Fix my website');
      expect(callArgs.html).toContain('Fix my website');
    });

    it('should skip when API key is not configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendJobOfferEmail(jobOfferData);

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should return false on Resend error', async () => {
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key', name: 'validation_error' },
      });

      const result = await sendJobOfferEmail(jobOfferData);

      expect(result).toBe(false);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send email via Resend when API key is configured', async () => {
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend.mockResolvedValueOnce({ data: { id: 'msg-456' }, error: null });

      const result = await sendPasswordResetEmail('user@example.com', 'http://localhost:3000/reset?token=abc');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toEqual(['user@example.com']);
      expect(callArgs.subject).toContain('Reset');
      expect(callArgs.html).toContain('http://localhost:3000/reset?token=abc');
    });

    it('should skip when API key is not configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendPasswordResetEmail('user@example.com', 'http://example.com/reset');

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailConfig', () => {
    it('should return true when API key is set', async () => {
      process.env.RESEND_API_KEY = 'test-resend-key';

      const result = await verifyEmailConfig();

      expect(result).toBe(true);
    });

    it('should return false when API key is not set', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await verifyEmailConfig();

      expect(result).toBe(false);
    });
  });
});
