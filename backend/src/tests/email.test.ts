import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Use vi.hoisted so the mock functions are available when vi.mock factory runs (hoisted above imports)
const { mockSend } = vi.hoisted(() => {
  return {
    mockSend: vi.fn(),
  };
});

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

// Import after mocking
import {
  generateUnsubscribeUrl,
  sendJobOfferEmail,
  sendVerificationEmail,
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

    it('should skip when no email provider is configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendJobOfferEmail(jobOfferData);

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should retry on Resend error and return false after all retries fail', async () => {
      vi.useFakeTimers();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', name: 'rate_limit_error' },
      });

      const resultPromise = sendJobOfferEmail(jobOfferData);
      // Advance past all retry delays (1s + 2s + 4s)
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await resultPromise;

      expect(result).toBe(false);
      // Should have retried 3 times
      expect(mockSend).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
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

    it('should skip when no email provider is configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendPasswordResetEmail('user@example.com', 'http://example.com/reset');

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('retry behavior', () => {
    it('should retry on Resend throw and succeed on second attempt', async () => {
      vi.useFakeTimers();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { id: 'msg-retry' }, error: null });

      const resultPromise = sendVerificationEmail('user@example.com', 'http://localhost:3000/verify?token=abc');
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('should return false when all retries fail', async () => {
      vi.useFakeTimers();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockSend.mockRejectedValue(new Error('Persistent failure'));

      const resultPromise = sendPasswordResetEmail('user@example.com', 'http://example.com/reset');
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await resultPromise;

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('should return false when no provider is configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendVerificationEmail('user@example.com', 'http://example.com/verify');

      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailConfig', () => {
    it('should return true when Resend is configured', async () => {
      process.env.RESEND_API_KEY = 'test-resend-key';

      const result = await verifyEmailConfig();

      expect(result).toBe(true);
    });

    it('should return false when no provider is configured', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await verifyEmailConfig();

      expect(result).toBe(false);
    });
  });
});
