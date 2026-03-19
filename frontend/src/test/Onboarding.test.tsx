/**
 * Legacy Onboarding.test.tsx — replaced by modular test files:
 *
 * - useStepFlow.test.ts (25 tests) — flow ordering, switching, clamping
 * - useCvProcessing.test.ts (43 tests) — 3-stage CV pipeline
 * - WizardSteps.test.tsx (22 tests) — step component types, flow comparison
 * - DataPersistence.test.ts (13 tests) — draft save/load, versioning, security
 * - CvOnboardingFlow.test.tsx (18 tests) — full user journeys with CV upload
 *
 * The old tests referenced a 7-step wizard starting with "Identity" step
 * ("Let's get to know you"). The current wizard has 12 steps starting with
 * "Connect" and uses i18n translation keys for all headings.
 */
import { describe, it, expect } from 'vitest';

describe('Onboarding (legacy redirect)', () => {
  it('legacy tests replaced — see useStepFlow.test.ts, useCvProcessing.test.ts, WizardSteps.test.tsx, DataPersistence.test.ts', () => {
    expect(true).toBe(true);
  });
});
