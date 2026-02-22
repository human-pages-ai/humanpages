import { describe, it, expect } from 'vitest';
import { generateReferralCode } from '../lib/referralCode.js';

describe('generateReferralCode', () => {
  it('should generate a 6-character code', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(6);
  });

  it('should only use URL-safe, readable characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateReferralCode();
      // No ambiguous characters: 0, O, I, l, 1
      expect(code).not.toMatch(/[0OIl1]/);
      // Only alphanumeric
      expect(code).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it('should generate unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateReferralCode());
    }
    // With 6 chars from a 54-char alphabet (~31 bits of entropy),
    // 1000 codes should all be unique
    expect(codes.size).toBe(1000);
  });
});
