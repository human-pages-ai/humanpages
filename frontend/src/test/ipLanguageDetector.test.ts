import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the detector module directly, so we unmock react-i18next
// (the global setup mocks it, but this test doesn't use React)
vi.unmock('react-i18next');

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

import ipLanguageDetector from '../i18n/ipLanguageDetector';

const CACHE_KEY = 'i18next_ip_lang';

describe('ipLanguageDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have name "ipGeo"', () => {
    expect(ipLanguageDetector.name).toBe('ipGeo');
  });

  it('should return undefined when no cache exists', () => {
    const result = ipLanguageDetector.lookup!({});
    expect(result).toBeUndefined();
  });

  it('should return cached language when cache is fresh', () => {
    const cached = JSON.stringify({
      language: 'es',
      timestamp: Date.now(),
    });
    localStorageStore[CACHE_KEY] = cached;

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBe('es');
  });

  it('should return undefined when cache is expired', () => {
    const cached = JSON.stringify({
      language: 'es',
      timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
    });
    localStorageStore[CACHE_KEY] = cached;

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBeUndefined();
  });

  it('should return undefined when cache is corrupted', () => {
    localStorageStore[CACHE_KEY] = 'invalid-json';

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBeUndefined();
  });

  it('should fire background fetch when no cache exists', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ language: 'fr' }),
    });

    ipLanguageDetector.lookup!({});

    // fetch should be called asynchronously
    expect(mockFetch).toHaveBeenCalledWith('/api/geo/language', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('should cache result from background fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ language: 'pt' }),
    });

    ipLanguageDetector.lookup!({});

    // Wait for the async fetch to complete
    await vi.waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    const setItemCall = mockLocalStorage.setItem.mock.calls.find(
      (call: string[]) => call[0] === CACHE_KEY
    );
    expect(setItemCall).toBeDefined();
    const cached = JSON.parse(setItemCall![1]);
    expect(cached.language).toBe('pt');
    expect(cached.timestamp).toBeGreaterThan(0);
  });

  it('should not crash when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    const result = ipLanguageDetector.lookup!({});
    expect(result).toBeUndefined();

    // Wait a tick for the rejected promise to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // localStorage should NOT have been updated
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });

  it('should not crash when fetch returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBeUndefined();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });

  it('should return cached French for French-Canadian user', () => {
    const cached = JSON.stringify({
      language: 'fr',
      timestamp: Date.now(),
    });
    localStorageStore[CACHE_KEY] = cached;

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBe('fr');
  });

  it('should return cached Portuguese for Brazilian user', () => {
    const cached = JSON.stringify({
      language: 'pt',
      timestamp: Date.now(),
    });
    localStorageStore[CACHE_KEY] = cached;

    const result = ipLanguageDetector.lookup!({});
    expect(result).toBe('pt');
  });

  it('cacheUserLanguage should be a no-op', () => {
    // Should not throw and should not set anything
    ipLanguageDetector.cacheUserLanguage!('es', {});
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });
});
