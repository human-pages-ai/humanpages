import { describe, it, expect, vi } from 'vitest';
import { StepConnect } from '../pages/onboarding/steps/StepConnect';
import { StepCvUpload } from '../pages/onboarding/steps/StepCvUpload';
import { StepSkills } from '../pages/onboarding/steps/StepSkills';
import { StepServices } from '../pages/onboarding/steps/StepServices';
import { StepLocation } from '../pages/onboarding/steps/StepLocation';
import { getFlow, totalSteps } from '../pages/onboarding/useStepFlow';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../lib/safeStorage', () => {
  const sessionStore: Record<string, string> = {};
  const makeMock = (s: Record<string, string>) => ({
    getItem: vi.fn((k: string) => s[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { s[k] = v; }),
    removeItem: vi.fn((k: string) => { delete s[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(s)) delete s[k]; }),
    isAvailable: vi.fn(() => true),
  });
  return {
    safeLocalStorage: makeMock({}),
    safeSessionStorage: makeMock(sessionStore),
  };
});

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ============================================================================
// TESTS — Step Flow Ordering
// ============================================================================

describe('Step Flow Ordering', () => {
  describe('NO_CV Flow', () => {
    it('should have exactly 12 steps', () => {
      const flow = getFlow(false);
      expect(flow).toHaveLength(12);
    });

    it('should start with connect step', () => {
      const flow = getFlow(false);
      expect(flow[0].id).toBe('connect');
    });

    it('should have cv-upload as second step', () => {
      const flow = getFlow(false);
      expect(flow[1].id).toBe('cv-upload');
    });

    it('should have skills at position 3 (index 2)', () => {
      const flow = getFlow(false);
      expect(flow[2].id).toBe('skills');
    });

    it('should have equipment at position 4 (index 3)', () => {
      const flow = getFlow(false);
      expect(flow[3].id).toBe('equipment');
    });

    it('should end with verification step', () => {
      const flow = getFlow(false);
      expect(flow[11].id).toBe('verification');
    });

    it('should contain all 12 required step IDs', () => {
      const flow = getFlow(false);
      const requiredIds = [
        'connect',
        'cv-upload',
        'skills',
        'equipment',
        'vouch',
        'location',
        'education',
        'payment',
        'services',
        'profile',
        'availability',
        'verification',
      ];
      const flowIds = flow.map((s) => s.id);
      requiredIds.forEach((id) => {
        expect(flowIds).toContain(id);
      });
    });
  });

  describe('CV Flow', () => {
    it('should have exactly 12 steps', () => {
      const flow = getFlow(true);
      expect(flow).toHaveLength(12);
    });

    it('should start with connect step', () => {
      const flow = getFlow(true);
      expect(flow[0].id).toBe('connect');
    });

    it('should have cv-upload as second step', () => {
      const flow = getFlow(true);
      expect(flow[1].id).toBe('cv-upload');
    });

    it('should have equipment at position 3 (index 2)', () => {
      const flow = getFlow(true);
      expect(flow[2].id).toBe('equipment');
    });

    it('should have skills at position 6 (index 5)', () => {
      const flow = getFlow(true);
      expect(flow[5].id).toBe('skills');
    });

    it('should have equipment before vouch before payment before skills', () => {
      const flow = getFlow(true);
      const equipIdx = flow.findIndex((s) => s.id === 'equipment');
      const vouchIdx = flow.findIndex((s) => s.id === 'vouch');
      const paymentIdx = flow.findIndex((s) => s.id === 'payment');
      const skillsIdx = flow.findIndex((s) => s.id === 'skills');

      expect(equipIdx).toBeLessThan(vouchIdx);
      expect(vouchIdx).toBeLessThan(paymentIdx);
      expect(paymentIdx).toBeLessThan(skillsIdx);
    });

    it('should contain all 12 required step IDs (same as NO_CV)', () => {
      const cvFlow = getFlow(true);
      const noCvFlow = getFlow(false);

      const cvIds = cvFlow.map((s) => s.id).sort();
      const noCvIds = noCvFlow.map((s) => s.id).sort();

      expect(cvIds).toEqual(noCvIds);
    });
  });

  describe('Flow comparison', () => {
    it('both flows should contain identical step IDs in different order', () => {
      const cvFlow = getFlow(true);
      const noCvFlow = getFlow(false);

      const cvIds = cvFlow.map((s) => s.id).sort();
      const noCvIds = noCvFlow.map((s) => s.id).sort();

      expect(cvIds).toEqual(noCvIds);
    });

    it('NO_CV flow should have skills before equipment', () => {
      const flow = getFlow(false);
      const skillsIdx = flow.findIndex((s) => s.id === 'skills');
      const equipIdx = flow.findIndex((s) => s.id === 'equipment');
      expect(skillsIdx).toBeLessThan(equipIdx);
    });

    it('CV flow should have equipment before skills', () => {
      const flow = getFlow(true);
      const equipIdx = flow.findIndex((s) => s.id === 'equipment');
      const skillsIdx = flow.findIndex((s) => s.id === 'skills');
      expect(equipIdx).toBeLessThan(skillsIdx);
    });
  });

  describe('totalSteps', () => {
    it('should return 12 for NO_CV flow', () => {
      const flow = getFlow(false);
      expect(totalSteps(flow)).toBe(12);
    });

    it('should return 12 for CV flow', () => {
      const flow = getFlow(true);
      expect(totalSteps(flow)).toBe(12);
    });

    it('should match flow.length for both flows', () => {
      const noCvFlow = getFlow(false);
      const cvFlow = getFlow(true);

      expect(totalSteps(noCvFlow)).toBe(noCvFlow.length);
      expect(totalSteps(cvFlow)).toBe(cvFlow.length);
    });
  });
});

// ============================================================================
// TESTS — Step Existence and Imports
// ============================================================================

describe('Step Component Imports', () => {
  it('should import all required step components successfully', () => {
    expect(StepConnect).toBeDefined();
    expect(StepCvUpload).toBeDefined();
    expect(StepSkills).toBeDefined();
    expect(StepServices).toBeDefined();
    expect(StepLocation).toBeDefined();
  });

  it('should have functions as step components', () => {
    expect(typeof StepConnect).toBe('function');
    expect(typeof StepCvUpload).toBe('function');
    expect(typeof StepSkills).toBe('function');
    expect(typeof StepServices).toBe('function');
    expect(typeof StepLocation).toBe('function');
  });
});
