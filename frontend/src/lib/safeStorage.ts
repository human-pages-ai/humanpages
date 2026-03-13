/**
 * Safe storage wrappers for localStorage and sessionStorage.
 *
 * Some in-app browsers (Facebook, Instagram, TikTok, Snapchat WebViews)
 * block or restrict access to Web Storage APIs. Unhandled SecurityError
 * exceptions from storage calls will crash the entire page.
 *
 * These wrappers catch storage errors and fall back to an in-memory store
 * so the app remains functional (data just won't persist across reloads).
 *
 * Usage:
 *   import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';
 *   safeLocalStorage.getItem('token');
 *   safeSessionStorage.setItem('key', 'value');
 *
 * IMPORTANT: Do NOT use raw localStorage or sessionStorage anywhere in the
 * codebase. The ESLint rule no-restricted-globals enforces this.
 */

const localMemory: Record<string, string> = {};
const sessionMemory: Record<string, string> = {};

/**
 * Safely access a Storage object (localStorage or sessionStorage).
 * Returns null if the storage is completely inaccessible — some in-app
 * browsers throw just from *referencing* window.localStorage.
 */
function getStorage(type: 'local' | 'session'): Storage | null {
  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function createSafeStorage(type: 'local' | 'session', memory: Record<string, string>) {
  return {
    getItem(key: string): string | null {
      try {
        const s = getStorage(type);
        return s ? s.getItem(key) : (memory[key] ?? null);
      } catch {
        return memory[key] ?? null;
      }
    },

    setItem(key: string, value: string): void {
      try {
        const s = getStorage(type);
        if (s) s.setItem(key, value);
        else memory[key] = value;
      } catch {
        memory[key] = value;
      }
    },

    removeItem(key: string): void {
      try {
        const s = getStorage(type);
        if (s) s.removeItem(key);
        else delete memory[key];
      } catch {
        delete memory[key];
      }
    },

    clear(): void {
      try {
        const s = getStorage(type);
        if (s) s.clear();
        else {
          for (const key of Object.keys(memory)) {
            delete memory[key];
          }
        }
      } catch {
        for (const key of Object.keys(memory)) {
          delete memory[key];
        }
      }
    },

    /**
     * Check if the underlying storage is actually available.
     * Useful for feature detection (e.g. showing "data won't persist" warnings).
     */
    isAvailable(): boolean {
      try {
        const s = getStorage(type);
        if (!s) return false;
        const testKey = '__storage_test__';
        s.setItem(testKey, '1');
        s.removeItem(testKey);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage('local', localMemory);
export const safeSessionStorage = createSafeStorage('session', sessionMemory);

// Legacy named exports for backward compatibility with existing imports
// (OAuthCallback.tsx etc. import these from '../lib/api')
export function safeGetItem(key: string): string | null {
  return safeLocalStorage.getItem(key);
}
export function safeSetItem(key: string, value: string): void {
  safeLocalStorage.setItem(key, value);
}
export function safeRemoveItem(key: string): void {
  safeLocalStorage.removeItem(key);
}
