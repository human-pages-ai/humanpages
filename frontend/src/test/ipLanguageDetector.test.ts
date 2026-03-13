// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock safeStorage — ipLanguageDetector uses safeLocalStorage instead of raw localStorage.
// We delegate to jsdom's built-in localStorage so tests can inspect stored values directly.
vi.mock('../lib/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((k: string) => localStorage.getItem(k)),
    setItem: vi.fn((k: string, v: string) => localStorage.setItem(k, v)),
    removeItem: vi.fn((k: string) => localStorage.removeItem(k)),
    clear: vi.fn(() => localStorage.clear()),
    isAvailable: vi.fn(() => true),
  },
  safeSessionStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    isAvailable: vi.fn(() => true),
  },
  safeGetItem: vi.fn((k: string) => localStorage.getItem(k)),
  safeSetItem: vi.fn((k: string, v: string) => localStorage.setItem(k, v)),
  safeRemoveItem: vi.fn((k: string) => localStorage.removeItem(k)),
}));

import {
  setUserLanguageChoice,
  getUserLanguageChoice,
  getCachedIpLanguage,
  fetchGeoLanguage,
  resolveInitialLanguageSync,
  resolveInitialLanguage,
} from '../i18n/ipLanguageDetector';

const CACHE_KEY = 'i18next_ip_lang';
const USER_CHOICE_KEY = 'i18next_user_choice';

describe('ipLanguageDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCachedIpLanguage', () => {
    it('should return null when no cache exists', () => {
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return cached language when cache is fresh', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'es',
        timestamp: Date.now(),
      }));
      expect(getCachedIpLanguage()).toBe('es');
    });

    it('should return null when cache is expired', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'es',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      }));
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return null when cache is corrupted', () => {
      localStorage.setItem(CACHE_KEY, 'invalid-json');
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return cached French for French-Canadian user', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'fr',
        timestamp: Date.now(),
      }));
      expect(getCachedIpLanguage()).toBe('fr');
    });

    it('should return cached Portuguese for Brazilian user', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      }));
      expect(getCachedIpLanguage()).toBe('pt');
    });
  });

  describe('user choice', () => {
    it('setUserLanguageChoice should save to localStorage', () => {
      setUserLanguageChoice('zh');
      expect(localStorage.getItem(USER_CHOICE_KEY)).toBe('zh');
    });

    it('getUserLanguageChoice should return saved choice', () => {
      localStorage.setItem(USER_CHOICE_KEY, 'fr');
      expect(getUserLanguageChoice()).toBe('fr');
    });

    it('getUserLanguageChoice should return null when no choice set', () => {
      expect(getUserLanguageChoice()).toBeNull();
    });
  });

  describe('fetchGeoLanguage', () => {
    it('should fetch from /api/geo/language and cache result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ language: 'es' }),
      });

      const result = await fetchGeoLanguage();
      expect(result).toBe('es');

      expect(mockFetch).toHaveBeenCalledWith('/api/geo/language', expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));

      // Should have cached the result
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      expect(cached.language).toBe('es');
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await fetchGeoLanguage();
      expect(result).toBeNull();
    });

    it('should return null on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await fetchGeoLanguage();
      expect(result).toBeNull();
    });

    it('should return null when response has no language', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'no data' }),
      });
      const result = await fetchGeoLanguage();
      expect(result).toBeNull();
    });
  });

  describe('resolveInitialLanguageSync', () => {
    it('should return user choice first', () => {
      localStorage.setItem(USER_CHOICE_KEY, 'fr');
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'es',
        timestamp: Date.now(),
      }));
      expect(resolveInitialLanguageSync()).toBe('fr');
    });

    it('should return cached IP language when no user choice', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      }));
      expect(resolveInitialLanguageSync()).toBe('pt');
    });

    it('should return null when nothing is cached', () => {
      expect(resolveInitialLanguageSync()).toBeNull();
    });
  });

  describe('resolveInitialLanguage', () => {
    it('should return user choice first, without fetching', async () => {
      localStorage.setItem(USER_CHOICE_KEY, 'fr');
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'es',
        timestamp: Date.now(),
      }));

      const result = await resolveInitialLanguage();
      expect(result).toBe('fr');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return cached IP language without fetching', async () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      }));

      const result = await resolveInitialLanguage();
      expect(result).toBe('pt');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch when no cache or user choice exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ language: 'vi' }),
      });

      const result = await resolveInitialLanguage();
      expect(result).toBe('vi');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return null when fetch fails and no cache', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await resolveInitialLanguage();
      expect(result).toBeNull();
    });
  });
});
