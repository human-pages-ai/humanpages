import { useState, useEffect, useRef, useCallback } from 'react';
import { safeSessionStorage } from '../../../lib/safeStorage';
import { STORAGE_KEY } from '../constants';
import type { OnboardingDraft } from '../types';

/**
 * Draft schema version. Increment this when OnboardingDraft shape changes.
 * Old drafts with a different version are discarded to prevent corruption.
 * v3: Removed dead fields (earliestStart, schedulePattern, taskDuration, paymentMethod)
 */
const DRAFT_VERSION = 3;

interface VersionedDraft {
  _v: number;
  data: Partial<OnboardingDraft>;
}

/** Save a partial draft to sessionStorage (merges with existing) */
export function saveDraft(draft: Partial<OnboardingDraft>): void {
  try {
    let existing: Partial<OnboardingDraft> = {};
    try {
      const raw = safeSessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Support versioned format
        if (parsed && typeof parsed === 'object' && parsed._v === DRAFT_VERSION) {
          existing = parsed.data || {};
        } else if (parsed && typeof parsed === 'object' && !('_v' in parsed)) {
          // Legacy unversioned draft — migrate it
          existing = parsed;
        }
        // If _v exists but doesn't match, discard (schema changed)
      }
    } catch {
      // Corrupt or unparseable data — start fresh
    }
    const versioned: VersionedDraft = { _v: DRAFT_VERSION, data: { ...existing, ...draft } };
    try {
      safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(versioned));
    } catch (err: any) {
      // QuotaExceededError on mobile or private browsing — fail silently
      if (err?.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, draft not saved');
      }
      throw err;
    }
  } catch {
    // Quota exceeded, private browsing, or other storage error — silently ignore
  }
}

/** Load the saved draft from sessionStorage */
export function loadDraft(): Partial<OnboardingDraft> | null {
  try {
    const raw = safeSessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard against prototype pollution from tampered session data
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) return null;

    // Handle versioned format
    if ('_v' in parsed) {
      if (parsed._v !== DRAFT_VERSION) {
        // Schema version mismatch — discard stale draft
        clearDraft();
        return null;
      }
      const data = parsed.data;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
      if ('__proto__' in data || 'constructor' in data || 'prototype' in data) return null;
      return data;
    }

    // Legacy unversioned draft — accept it but next save will version it
    return parsed;
  } catch { return null; }
}

/** Clear the saved draft */
export function clearDraft(): void {
  try { safeSessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export type DraftSaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Hook: auto-saves wizard state to sessionStorage, debounced at 500ms.
 * Also provides a saveNow() function for immediate saves (e.g., on navigation).
 * Returns save status for UI indicator and saveNow callback.
 * @param draftData - current form state to persist
 */
export function useDraftPersistence(draftData: Partial<OnboardingDraft>): DraftSaveStatus {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle');
  const isFirstRender = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  // Expose saveNow as a function that can be called from outside
  const saveNowRef = useRef(() => {
    saveDraft(draftData);
  });

  // Keep saveNowRef updated with latest draftData
  useEffect(() => {
    saveNowRef.current = () => saveDraft(draftData);
  }, [draftData]);

  // Attach to window for access from goToPosition
  useEffect(() => {
    (window as any).__draftSaveNow = saveNowRef.current;
    return () => {
      delete (window as any).__draftSaveNow;
    };
  }, []);

  // Debounced save on data changes
  useEffect(() => {
    let active = true;
    // Don't show indicator on first render (loading draft data)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    clearTimers();
    setSaveStatus('saving');

    timerRef.current = setTimeout(() => {
      if (!active) return;
      saveDraft(draftData);
      setSaveStatus('saved');
      // Fade back to idle after 2s
      fadeTimerRef.current = setTimeout(() => { if (active) setSaveStatus('idle'); }, 2000);
    }, 500);

    return () => { active = false; clearTimers(); };
    // Intentionally using JSON.stringify for deep comparison — these are plain objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draftData)]);

  // Synchronous save on beforeunload to handle network loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft(draftData);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftData]);

  return saveStatus;
}
