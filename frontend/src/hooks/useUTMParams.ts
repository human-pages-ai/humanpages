import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { safeSessionStorage } from '../lib/safeStorage';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/**
 * Captures UTM parameters from the URL and persists them in sessionStorage.
 * Returns the captured params as an object.
 */
export function useUTMParams() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        safeSessionStorage.setItem(key, value);
      }
    }
  }, [searchParams]);

  const params: Record<string, string | undefined> = {};
  for (const key of UTM_KEYS) {
    params[key] = searchParams.get(key) || undefined;
  }
  return params;
}

/** Read persisted UTM params from sessionStorage (for use in signup/conversion flows). */
export function getStoredUTMParams(): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const key of UTM_KEYS) {
    params[key] = safeSessionStorage.getItem(key) || undefined;
  }
  return params;
}
