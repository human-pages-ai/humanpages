import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

import {
  setUserLanguageChoice,
  getUserLanguageChoice,
  getCachedIpLanguage,
  fetchGeoLanguage,
  resolveInitialLanguage,
} from '../i18n/ipLanguageDetector';

const CACHE_KEY = 'i18next_ip_lang';
const USER_CHOICE_KEY = 'i18next_user_choice';

describe('ipLanguageDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCachedIpLanguage', () => {
    it('should return null when no cache exists', () => {
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return cached language when cache is fresh', () => {
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'es',
        timestamp: Date.now(),
      });
      expect(getCachedIpLanguage()).toBe('es');
    });

    it('should return null when cache is expired', () => {
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'es',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      });
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return null when cache is corrupted', () => {
      localStorageStore[CACHE_KEY] = 'invalid-json';
      expect(getCachedIpLanguage()).toBeNull();
    });

    it('should return cached French for French-Canadian user', () => {
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'fr',
        timestamp: Date.now(),
      });
      expect(getCachedIpLanguage()).toBe('fr');
    });

    it('should return cached Portuguese for Brazilian user', () => {
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      });
      expect(getCachedIpLanguage()).toBe('pt');
    });
  });

  describe('user choice', () => {
    it('setUserLanguageChoice should save to localStorage', () => {
      setUserLanguageChoice('zh');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(USER_CHOICE_KEY, 'zh');
    });

    it('getUserLanguageChoice should return saved choice', () => {
      localStorageStore[USER_CHOICE_KEY] = 'fr';
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
      const setItemCall = mockLocalStorage.setItem.mock.calls.find(
        (call: string[]) => call[0] === CACHE_KEY
      );
      expect(setItemCall).toBeDefined();
      const cached = JSON.parse(setItemCall![1]);
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

  describe('resolveInitialLanguage', () => {
    it('should return user choice first, without fetching', async () => {
      localStorageStore[USER_CHOICE_KEY] = 'fr';
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'es',
        timestamp: Date.now(),
      });

      const result = await resolveInitialLanguage();
      expect(result).toBe('fr');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return cached IP language without fetching', async () => {
      localStorageStore[CACHE_KEY] = JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      });

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
