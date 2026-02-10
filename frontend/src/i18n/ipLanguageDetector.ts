import type { CustomDetector } from 'i18next-browser-languagedetector';

const CACHE_KEY = 'i18next_ip_lang';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedResult {
  language: string;
  timestamp: number;
}

/**
 * Custom i18next language detector that determines language from the user's
 * IP address via our backend /api/geo/language endpoint.
 *
 * This detector is async-aware: on first visit it makes a fetch call and
 * caches the result in localStorage. The initial detection returns the cached
 * value (if any), and the fetch runs in the background to update it.
 */
const ipLanguageDetector: CustomDetector = {
  name: 'ipGeo',

  lookup(_options: object): string | undefined {
    // Return cached value synchronously if available
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: CachedResult = JSON.parse(raw);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.language;
        }
      }
    } catch {
      // ignore parse errors
    }

    // Fire-and-forget: fetch from backend and cache for next page load.
    // We don't block the initial render — if there's no cache, this detector
    // returns undefined and the next detector in the chain (navigator) is used.
    // On the next page load, the cached IP-based language will be picked up.
    fetchAndCache();

    return undefined;
  },

  cacheUserLanguage(_lng: string, _options: object): void {
    // We don't cache the user's manual language choice here —
    // that's handled by the localStorage detector.
  },
};

async function fetchAndCache(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/geo/language', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return;

    const data = await response.json();
    if (data.language) {
      const cached: CachedResult = {
        language: data.language,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    }
  } catch {
    // Silently fail — geo detection is best-effort
  }
}

export default ipLanguageDetector;
