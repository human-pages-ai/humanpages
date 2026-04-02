import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { analytics, type WizardEventSuffix } from './analytics';


// ─── Type-safe event name builder ───
/**
 * Helper to ensure wizard event names are type-safe.
 * When adding a new tracking method, ensure the suffix is added to WizardEventSuffix.
 *
 * This is a type-safe utility that forces developers to update WizardEventSuffix
 * when adding new tracking methods.
 */
export const buildWizardEvent = (wizardName: string, suffix: WizardEventSuffix): `${string}_${WizardEventSuffix}` => {
  return `${wizardName}_${suffix}`;
};

// ─── Types ───

/** Configuration for a wizard analytics instance */
export interface WizardAnalyticsConfig {
  /** Unique name for this wizard (e.g., 'onboarding', 'job_application', 'listing_creation') */
  wizardName: string;
  /** Total number of steps in the wizard */
  totalSteps: number;
  /** Current step ID */
  currentStepId: string;
  /** Whether the wizard has been completed (suppresses abandonment) */
  isCompleted: boolean;
  /** Optional device context provider (injected by consumer) */
  getDeviceContext?: () => Record<string, unknown>;
}

/** All tracking methods available to wizard steps */
export interface WizardAnalyticsAPI {
  /** Unique ID for this wizard run (groups all events from one attempt) */
  runId: string;
  /** Name of the wizard */
  wizardName: string;

  // ─── Field tracking ───
  trackFieldFocus: (fieldName: string) => void;
  trackFieldBlur: (fieldName: string, hasValue: boolean) => void;
  trackFieldError: (fieldName: string, errorType: string) => void;

  // ─── Button tracking ───
  trackButtonClick: (buttonName: string, action?: string) => void;

  // ─── Help/info tracking ───
  trackHelpViewed: (helpId: string) => void;

  // ─── Form lifecycle (for sub-forms within a step) ───
  trackFormOpened: (formName: string) => void;
  trackFormAbandoned: (formName: string, fieldsCompleted: number) => void;
  trackFormCompleted: (formName: string, properties?: Record<string, string | number | boolean>) => void;

  // ─── Item tracking (for lists: skills, services, equipment, etc.) ───
  trackItemAdded: (itemType: string, item: string, source?: string) => void;
  trackItemRemoved: (itemType: string, item: string) => void;

  // ─── Suggestion tracking (for AI/CV suggestions) ───
  trackSuggestionAccepted: (suggestionType: string) => void;
  trackSuggestionIgnored: (suggestionType: string, totalSuggestions: number) => void;
}

// ─── Run ID generator ───

function generateRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Context ───

const WizardAnalyticsContext = createContext<WizardAnalyticsAPI | null>(null);

/**
 * Access the wizard analytics API from any child component.
 * Returns null if not inside a WizardAnalyticsProvider — safe to use with optional chaining.
 */
export function useWizardAnalytics(): WizardAnalyticsAPI | null {
  return useContext(WizardAnalyticsContext);
}

// ─── Provider ───

interface WizardAnalyticsProviderProps {
  config: WizardAnalyticsConfig;
  children: ReactNode;
}

/**
 * Wraps a wizard in analytics tracking. Provides:
 * - Automatic abandonment tracking (via track for mobile/in-app reliability)
 * - Context-based analytics API (no prop drilling needed)
 * - wizardRunId grouping for all events
 *
 * Usage:
 * ```tsx
 * <WizardAnalyticsProvider config={{ wizardName: 'onboarding', totalSteps: 12, currentStepId, isCompleted, getDeviceContext }}>
 *   <StepComponent />
 * </WizardAnalyticsProvider>
 * ```
 */
export function WizardAnalyticsProvider({ config, children }: WizardAnalyticsProviderProps) {
  const { wizardName, totalSteps, currentStepId, isCompleted, getDeviceContext } = config;
  const runId = useRef(generateRunId()).current;
  const wizardStartRef = useRef(Date.now());
  const stepStartRef = useRef(Date.now());
  const completedRef = useRef(isCompleted);
  const currentStepRef = useRef(currentStepId);

  // Keep refs in sync
  useEffect(() => { completedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => {
    currentStepRef.current = currentStepId;
    stepStartRef.current = Date.now();
  }, [currentStepId]);

  // ─── Shared properties added to every event ───
  const baseProps = useCallback(() => ({
    wizard_run_id: runId,
    wizard_name: wizardName,
    step: currentStepRef.current,
  }), [runId, wizardName]);

  // ─── Abandonment tracking ───
  useEffect(() => {
    let hasFired = false;
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

    const fireAbandonment = () => {
      if (completedRef.current || hasFired) return;
      hasFired = true;
      const beaconPayload: Record<string, unknown> = {
        ...baseProps(),
        total_steps: totalSteps,
        step_duration_seconds: Math.round((Date.now() - stepStartRef.current) / 1000),
        total_duration_seconds: Math.round((Date.now() - wizardStartRef.current) / 1000),
      };

      // Inject device context if provider supplied it
      if (getDeviceContext) {
        const deviceContext = getDeviceContext();
        Object.assign(beaconPayload, deviceContext);
      }

      // Cast to any to allow dynamic event names
      analytics.track(`${wizardName}_abandoned` as any, beaconPayload as any);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        visibilityTimer = setTimeout(() => {
          if (document.visibilityState === 'hidden') fireAbandonment();
        }, 5000);
      } else if (document.visibilityState === 'visible') {
        if (visibilityTimer) { clearTimeout(visibilityTimer); visibilityTimer = null; }
      }
    };

    window.addEventListener('beforeunload', fireAbandonment);
    window.addEventListener('pagehide', fireAbandonment);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      window.removeEventListener('beforeunload', fireAbandonment);
      window.removeEventListener('pagehide', fireAbandonment);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wizardName, totalSteps, baseProps, getDeviceContext]);

  // ─── Tracking methods ───
  const trackFieldFocus = useCallback((fieldName: string) => {
    analytics.track(`${wizardName}_field_focused` as any, { ...baseProps(), field: fieldName });
  }, [wizardName, baseProps]);

  const trackFieldBlur = useCallback((fieldName: string, hasValue: boolean) => {
    analytics.track(`${wizardName}_field_blurred` as any, { ...baseProps(), field: fieldName, has_value: hasValue });
  }, [wizardName, baseProps]);

  const trackFieldError = useCallback((fieldName: string, errorType: string) => {
    analytics.track(`${wizardName}_field_error` as any, { ...baseProps(), field: fieldName, error_type: errorType });
  }, [wizardName, baseProps]);

  const trackButtonClick = useCallback((buttonName: string, action?: string) => {
    analytics.track(`${wizardName}_button_clicked` as any, { ...baseProps(), button: buttonName, action });
  }, [wizardName, baseProps]);

  const trackHelpViewed = useCallback((helpId: string) => {
    analytics.track(`${wizardName}_help_viewed` as any, { ...baseProps(), help_id: helpId });
  }, [wizardName, baseProps]);

  const trackFormOpened = useCallback((formName: string) => {
    analytics.track(`${wizardName}_form_opened` as any, { ...baseProps(), form_name: formName });
  }, [wizardName, baseProps]);

  const trackFormAbandoned = useCallback((formName: string, fieldsCompleted: number) => {
    analytics.track(`${wizardName}_form_abandoned` as any, { ...baseProps(), form_name: formName, fields_completed: fieldsCompleted });
  }, [wizardName, baseProps]);

  const trackFormCompleted = useCallback((formName: string, properties?: Record<string, string | number | boolean>) => {
    analytics.track(`${wizardName}_form_completed` as any, { ...baseProps(), form_name: formName, ...properties });
  }, [wizardName, baseProps]);

  const trackItemAdded = useCallback((itemType: string, item: string, source?: string) => {
    analytics.track(`${wizardName}_item_added` as any, { ...baseProps(), item_type: itemType, item, source });
  }, [wizardName, baseProps]);

  const trackItemRemoved = useCallback((itemType: string, item: string) => {
    analytics.track(`${wizardName}_item_removed` as any, { ...baseProps(), item_type: itemType, item });
  }, [wizardName, baseProps]);

  const trackSuggestionAccepted = useCallback((suggestionType: string) => {
    analytics.track(`${wizardName}_suggestion_accepted` as any, { ...baseProps(), suggestion_type: suggestionType });
  }, [wizardName, baseProps]);

  const trackSuggestionIgnored = useCallback((suggestionType: string, totalSuggestions: number) => {
    analytics.track(`${wizardName}_suggestion_ignored` as any, { ...baseProps(), suggestion_type: suggestionType, total_suggestions: totalSuggestions });
  }, [wizardName, baseProps]);

  const api: WizardAnalyticsAPI = {
    runId,
    wizardName,
    trackFieldFocus,
    trackFieldBlur,
    trackFieldError,
    trackButtonClick,
    trackHelpViewed,
    trackFormOpened,
    trackFormAbandoned,
    trackFormCompleted,
    trackItemAdded,
    trackItemRemoved,
    trackSuggestionAccepted,
    trackSuggestionIgnored,
  };

  return (
    <WizardAnalyticsContext.Provider value={api}>
      {children}
    </WizardAnalyticsContext.Provider>
  );
}

// ─── Helper hooks (DRY field/button tracking) ───

/**
 * Returns onFocus/onBlur props for an input/textarea with automatic analytics tracking.
 * Use as spread: `<input {...trackedField.props} />`
 *
 * Usage:
 * ```tsx
 * const nameField = useTrackedField('name');
 * <input value={name} onChange={...} {...nameField.props} />
 * ```
 */
export function useTrackedField(fieldName: string) {
  const wa = useWizardAnalytics();
  return {
    props: {
      onFocus: () => wa?.trackFieldFocus(fieldName),
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        wa?.trackFieldBlur(fieldName, !!e.target.value);
      },
    },
    trackError: (errorType: string) => wa?.trackFieldError(fieldName, errorType),
  };
}

/**
 * Returns an onClick handler with automatic analytics tracking.
 *
 * Usage:
 * ```tsx
 * const submitBtn = useTrackedButton('submit', 'add_service');
 * <button onClick={() => { submitBtn.track(); handleSubmit(); }}>Submit</button>
 * ```
 */
export function useTrackedButton(buttonName: string, action?: string) {
  const wa = useWizardAnalytics();
  return {
    track: () => wa?.trackButtonClick(buttonName, action),
  };
}
