import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setApplyIntent,
  getApplyIntent,
  clearApplyIntent,
  getApplyRedirect,
} from '../lib/applyIntent';

const STORAGE_KEY = 'hp_apply_intent';

describe('applyIntent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setApplyIntent', () => {
    it('stores positionId and timestamp in localStorage', () => {
      setApplyIntent('software-engineer');
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.positionId).toBe('software-engineer');
      expect(typeof parsed.timestamp).toBe('number');
    });

    it('stores positionTitle when provided', () => {
      setApplyIntent('software-engineer', 'Software Engineer');
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed.positionTitle).toBe('Software Engineer');
    });

    it('stores undefined positionTitle when not provided', () => {
      setApplyIntent('qa-tester');
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed.positionId).toBe('qa-tester');
      expect(parsed.positionTitle).toBeUndefined();
    });
  });

  describe('getApplyIntent', () => {
    it('returns null when localStorage is empty', () => {
      expect(getApplyIntent()).toBeNull();
    });

    it('returns intent when valid and within 24h TTL', () => {
      setApplyIntent('digital-marketer', 'Digital Marketer');
      const intent = getApplyIntent();
      expect(intent).not.toBeNull();
      expect(intent!.positionId).toBe('digital-marketer');
      expect(intent!.positionTitle).toBe('Digital Marketer');
    });

    it('returns null and cleans up when intent is expired (>24h)', () => {
      vi.useFakeTimers();
      const now = new Date('2025-06-01T12:00:00Z').getTime();
      vi.setSystemTime(now);

      setApplyIntent('software-engineer');

      // Advance past 24 hours
      vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1);

      expect(getApplyIntent()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns intent when exactly at 24h boundary', () => {
      vi.useFakeTimers();
      const now = new Date('2025-06-01T12:00:00Z').getTime();
      vi.setSystemTime(now);

      setApplyIntent('software-engineer');

      // Advance to exactly 24 hours (should still be valid — not exceeded)
      vi.setSystemTime(now + 24 * 60 * 60 * 1000);

      expect(getApplyIntent()).not.toBeNull();
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
      expect(getApplyIntent()).toBeNull();
      // Should clean up corrupted entry
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('clearApplyIntent', () => {
    it('removes the intent from localStorage', () => {
      setApplyIntent('software-engineer');
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      clearApplyIntent();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does not throw when localStorage is already empty', () => {
      expect(() => clearApplyIntent()).not.toThrow();
    });
  });

  describe('getApplyRedirect', () => {
    it('returns /careers when an intent exists', () => {
      setApplyIntent('software-engineer');
      expect(getApplyRedirect()).toBe('/careers');
    });

    it('returns null when no intent exists', () => {
      expect(getApplyRedirect()).toBeNull();
    });

    it('does NOT clear the intent (CareersPage does that)', () => {
      setApplyIntent('software-engineer');
      getApplyRedirect();
      // Intent should still be there
      expect(getApplyIntent()).not.toBeNull();
    });
  });
});
