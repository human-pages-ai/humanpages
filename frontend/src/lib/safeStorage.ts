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

function createSafeStorage(storage: Storage, memory: Record<string, string>) {
  return {
    getItem(key: string): string | null {
      try {
        return storage.getItem(key);
      } catch {
        return memory[key] ?? null;
      }
    },

    setItem(key: string, value: string): void {
      try {
        storage.setItem(key, value);
      } catch {
        memory[key] = value;
      }
    },

    removeItem(key: string): void {
      try {
        storage.removeItem(key);
      } catch {
        delete memory[key];
      }
    },

    clear(): void {
      try {
        storage.clear();
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
        const testKey = '__storage_test__';
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage(localStorage, localMemory);
export const safeSessionStorage = createSafeStorage(sessionStorage, sessionMemory);

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
