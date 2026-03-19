import { describe, it, expect } from 'vitest';
import {
  getFlow,
  getStepLabels,
  stepAt,
  totalSteps,
  type StepId,
} from '../pages/onboarding/useStepFlow';

describe('useStepFlow', () => {
  describe('getFlow - NO_CV flow', () => {
    it('should return 12 steps', () => {
      const flow = getFlow(false);
      expect(flow).toHaveLength(12);
    });

    it('should have skills before equipment', () => {
      const flow = getFlow(false);
      const skillsIndex = flow.findIndex((s) => s.id === 'skills');
      const equipmentIndex = flow.findIndex((s) => s.id === 'equipment');
      expect(skillsIndex).toBe(2); // position 3 (0-indexed)
      expect(equipmentIndex).toBe(3); // position 4 (0-indexed)
      expect(skillsIndex).toBeLessThan(equipmentIndex);
    });

    it('should start with connect and cv-upload', () => {
      const flow = getFlow(false);
      expect(flow[0].id).toBe('connect');
      expect(flow[0].label).toBe('Connect');
      expect(flow[1].id).toBe('cv-upload');
      expect(flow[1].label).toBe('CV');
    });
  });

  describe('getFlow - CV_UPLOADED flow', () => {
    it('should return 12 steps', () => {
      const flow = getFlow(true);
      expect(flow).toHaveLength(12);
    });

    it('should have equipment right after cv-upload', () => {
      const flow = getFlow(true);
      expect(flow[2].id).toBe('equipment');
      expect(flow[2].label).toBe('Equipment');
    });

    it('should defer skills to position 6', () => {
      const flow = getFlow(true);
      expect(flow[5].id).toBe('skills');
      expect(flow[5].label).toBe('Skills');
    });

    it('should contain the same step IDs as NO_CV flow', () => {
      const noCV = getFlow(false);
      const withCV = getFlow(true);

      const noCVIds = noCV.map((s) => s.id).sort();
      const withCVIds = withCV.map((s) => s.id).sort();

      expect(noCVIds).toEqual(withCVIds);
    });
  });

  describe('Flow switching (simulating revert)', () => {
    it('should move skills from position 6 back to position 3 when reverting from CV to NO_CV', () => {
      const withCV = getFlow(true);
      const noCV = getFlow(false);

      const skillsPosWithCV = withCV.findIndex((s) => s.id === 'skills');
      const skillsPosNoCV = noCV.findIndex((s) => s.id === 'skills');

      expect(skillsPosWithCV).toBe(5); // position 6 (0-indexed)
      expect(skillsPosNoCV).toBe(2); // position 3 (0-indexed)
    });

    it('should handle user on equipment step across both flows', () => {
      const noCV = getFlow(false);
      const withCV = getFlow(true);

      const equipmentInNoCV = noCV.find((s) => s.id === 'equipment');
      const equipmentInWithCV = withCV.find((s) => s.id === 'equipment');

      expect(equipmentInNoCV).toBeDefined();
      expect(equipmentInWithCV).toBeDefined();

      const equipmentPosNoCV = noCV.indexOf(equipmentInNoCV!);
      const equipmentPosWithCV = withCV.indexOf(equipmentInWithCV!);

      expect(equipmentPosNoCV).toBe(3); // position 4
      expect(equipmentPosWithCV).toBe(2); // position 3
    });
  });

  describe('getStepLabels', () => {
    it('should return correct label array for NO_CV flow', () => {
      const flow = getFlow(false);
      const labels = getStepLabels(flow);

      expect(labels).toEqual([
        'Connect',
        'CV',
        'Skills',
        'Equipment',
        'Vouch',
        'Location',
        'Education',
        'Payment',
        'Services',
        'Profile',
        'Availability',
        'Verify',
      ]);
    });

    it('should return correct label array for CV_UPLOADED flow', () => {
      const flow = getFlow(true);
      const labels = getStepLabels(flow);

      expect(labels).toEqual([
        'Connect',
        'CV',
        'Equipment',
        'Vouch',
        'Payment',
        'Skills',
        'Location',
        'Education',
        'Services',
        'Profile',
        'Availability',
        'Verify',
      ]);
    });

    it('should have same number of labels as steps', () => {
      const flowNoCV = getFlow(false);
      const flowWithCV = getFlow(true);

      expect(getStepLabels(flowNoCV)).toHaveLength(flowNoCV.length);
      expect(getStepLabels(flowWithCV)).toHaveLength(flowWithCV.length);
    });
  });

  describe('stepAt', () => {
    it('should return correct step at position 1', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, 1)).toBe('connect');
    });

    it('should return correct step at middle position', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, 6)).toBe('location');
    });

    it('should return correct step at last position', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, 12)).toBe('verification');
    });

    it('should clamp position 0 to first step', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, 0)).toBe('connect');
    });

    it('should clamp negative position to first step', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, -5)).toBe('connect');
    });

    it('should clamp out-of-bounds position to last step', () => {
      const flow = getFlow(false);
      expect(stepAt(flow, 999)).toBe('verification');
    });

    it('should handle stepAt with CV flow', () => {
      const flow = getFlow(true);
      expect(stepAt(flow, 1)).toBe('connect');
      expect(stepAt(flow, 3)).toBe('equipment');
      expect(stepAt(flow, 6)).toBe('skills');
    });
  });

  describe('totalSteps', () => {
    it('should return 12 for NO_CV flow', () => {
      const flow = getFlow(false);
      expect(totalSteps(flow)).toBe(12);
    });

    it('should return 12 for CV_UPLOADED flow', () => {
      const flow = getFlow(true);
      expect(totalSteps(flow)).toBe(12);
    });

    it('should match flow length', () => {
      const flowNoCV = getFlow(false);
      const flowWithCV = getFlow(true);

      expect(totalSteps(flowNoCV)).toBe(flowNoCV.length);
      expect(totalSteps(flowWithCV)).toBe(flowWithCV.length);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete user journey through NO_CV flow', () => {
      const flow = getFlow(false);
      const total = totalSteps(flow);

      expect(total).toBe(12);

      for (let position = 1; position <= total; position++) {
        const step = stepAt(flow, position);
        expect(step).toBeDefined();
        const stepDef = flow[position - 1];
        expect(stepDef.id).toBe(step);
      }
    });

    it('should handle complete user journey through CV flow', () => {
      const flow = getFlow(true);
      const total = totalSteps(flow);

      expect(total).toBe(12);

      for (let position = 1; position <= total; position++) {
        const step = stepAt(flow, position);
        expect(step).toBeDefined();
        const stepDef = flow[position - 1];
        expect(stepDef.id).toBe(step);
      }
    });

    it('should have all required step IDs in both flows', () => {
      const requiredSteps: StepId[] = [
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

      const flowNoCV = getFlow(false);
      const flowWithCV = getFlow(true);

      const noCVIds = flowNoCV.map((s) => s.id);
      const withCVIds = flowWithCV.map((s) => s.id);

      requiredSteps.forEach((stepId) => {
        expect(noCVIds).toContain(stepId);
        expect(withCVIds).toContain(stepId);
      });
    });
  });
});
