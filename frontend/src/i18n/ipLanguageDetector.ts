const CACHE_KEY = 'i18next_ip_lang';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Key used to record explicit user language choice (e.g., from language picker)
const USER_CHOICE_KEY = 'i18next_user_choice';

interface CachedResult {
  language: string;
  timestamp: number;
}

/**
 * Mark that the user explicitly chose a language (call from your language picker).
 * When this flag is set, IP-based detection will NOT override it.
 */
export function setUserLanguageChoice(lang: string): void {
  localStorage.setItem(USER_CHOICE_KEY, lang);
}

/**
 * Get the user's explicit language choice, if any.
 */
export function getUserLanguageChoice(): string | null {
  return localStorage.getItem(USER_CHOICE_KEY);
}

/**
 * Get cached IP-based language, if fresh.
 */
export function getCachedIpLanguage(): string | null {
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
  return null;
}

/**
 * Fetch the user's language from the backend geo endpoint.
 * Races against a timeout so we never delay the first render for too long.
 * Result is cached in localStorage for instant subsequent visits.
 */
export async function fetchGeoLanguage(timeoutMs = 1500): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('/api/geo/language', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.language) {
      const cached: CachedResult = {
        language: data.language,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      return data.language;
    }
  } catch {
    // Silently fail — geo detection is best-effort
  }
  return null;
}

/**
 * Synchronously resolve the initial language from local storage.
 * Returns the language immediately if available (user choice or IP cache).
 * Returns null if a network fetch is needed.
 */
export function resolveInitialLanguageSync(): string | null {
  // 1. User explicitly picked a language — always respect it
  const userChoice = getUserLanguageChoice();
  if (userChoice) return userChoice;

  // 2. Cached IP-based result (instant, no network)
  const cached = getCachedIpLanguage();
  if (cached) return cached;

  return null;
}

/**
 * Resolve the initial language to use.
 * Priority: user's explicit choice → cached IP result → fresh IP fetch → null (let i18next decide)
 */
export async function resolveInitialLanguage(): Promise<string | null> {
  const sync = resolveInitialLanguageSync();
  if (sync) return sync;

  // 3. Fetch from backend (races against timeout for fast first load)
  return fetchGeoLanguage();
}
