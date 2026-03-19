import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDraft,
  loadDraft,
  clearDraft,
} from '../pages/onboarding/hooks/useDraftPersistence';

// ============================================================================
// TESTS — saveDraft / loadDraft / clearDraft
// ============================================================================

describe('Draft Persistence Functions', () => {
  beforeEach(() => {
    // Clear draft via the same API the code uses (handles both real sessionStorage and in-memory fallback)
    clearDraft();
    sessionStorage.clear();
  });

  describe('saveDraft and loadDraft', () => {
    it('should save and load a simple draft', () => {
      const draft = { name: 'Test User', bio: 'Test bio', smsNumber: '' };
      saveDraft(draft as any);
      const loaded = loadDraft();

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Test User');
      expect(loaded?.bio).toBe('Test bio');
    });

    it('should save draft with skills array', () => {
      const draft = { name: 'Jane Dev', skills: ['React', 'TypeScript'], smsNumber: '' };
      saveDraft(draft as any);
      const loaded = loadDraft();

      expect(loaded?.skills).toEqual(['React', 'TypeScript']);
    });

    it('should merge new draft data with existing data', () => {
      saveDraft({ name: 'Jane', smsNumber: '' } as any);
      saveDraft({ bio: 'Developer' } as any);
      const loaded = loadDraft();

      expect(loaded?.name).toBe('Jane');
      expect(loaded?.bio).toBe('Developer');
    });

    it('should overwrite existing fields when saving new values', () => {
      saveDraft({ name: 'Jane', smsNumber: '' } as any);
      saveDraft({ name: 'John' } as any);
      const loaded = loadDraft();

      expect(loaded?.name).toBe('John');
    });

    it('should handle empty draft', () => {
      saveDraft({} as any);
      const loaded = loadDraft();

      expect(loaded).toBeDefined();
    });

    it('should save complex nested objects', () => {
      const draft = {
        name: 'Jane',
        educationEntries: [
          { institution: 'MIT', degree: 'BS', field: 'CS', country: 'US' },
        ],
        languageEntries: [{ language: 'English', proficiency: 'Native' }, { language: 'French', proficiency: 'Fluent' }],
        smsNumber: '',
      };
      saveDraft(draft as any);
      const loaded = loadDraft();

      expect(loaded?.educationEntries).toEqual(draft.educationEntries);
      expect(loaded?.languageEntries).toEqual(draft.languageEntries);
    });

    it('should return null when no draft exists', () => {
      const loaded = loadDraft();
      expect(loaded).toBeNull();
    });

    it('should handle null values in draft', () => {
      const draft = { name: 'Jane', bio: null, smsNumber: '' };
      saveDraft(draft as any);
      const loaded = loadDraft();

      expect(loaded?.name).toBe('Jane');
      expect(loaded?.bio).toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('should clear saved draft', () => {
      saveDraft({ name: 'Test User', smsNumber: '' } as any);
      clearDraft();
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should not fail when clearing non-existent draft', () => {
      expect(() => clearDraft()).not.toThrow();
    });

    it('should allow saving new draft after clearing', () => {
      saveDraft({ name: 'First', smsNumber: '' } as any);
      clearDraft();
      saveDraft({ name: 'Second', smsNumber: '' } as any);
      const loaded = loadDraft();

      expect(loaded?.name).toBe('Second');
    });
  });

  describe('Draft versioning', () => {
    it('should save draft with version number', () => {
      saveDraft({ name: 'Jane', smsNumber: '' } as any);
      // Get the raw storage value
      const raw = sessionStorage.getItem('hp_onboarding_draft');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);

      expect(parsed._v).toBeDefined();
      expect(parsed.data).toBeDefined();
      expect(parsed.data.name).toBe('Jane');
    });

    it('should accept draft with matching version', () => {
      // Simulate a versioned draft
      const versioned = { _v: 4, data: { name: 'Jane', skills: ['React'], smsNumber: '' } };
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(versioned));
      const loaded = loadDraft();

      expect(loaded?.name).toBe('Jane');
      expect(loaded?.skills).toEqual(['React']);
    });

    it('should discard draft with mismatched version', () => {
      // Simulate a draft with wrong version
      const versioned = { _v: 1, data: { name: 'Jane', smsNumber: '' } };
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(versioned));
      const loaded = loadDraft();

      // Should return null and clear the storage
      expect(loaded).toBeNull();
    });
  });

  describe('Prototype pollution protection', () => {
    it('should reject data with __proto__ key', () => {
      // JSON.stringify strips __proto__, so we must craft the string directly
      sessionStorage.setItem('hp_onboarding_draft', '{"_v":4,"data":{"__proto__":{"isAdmin":true}}}');
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should reject data with constructor key', () => {
      const malicious = { _v: 4, data: { constructor: { isAdmin: true } } };
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(malicious));
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should reject data with prototype key', () => {
      const malicious = { _v: 4, data: { prototype: { isAdmin: true } } };
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(malicious));
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should reject non-object data', () => {
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify('not an object'));
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should reject array data', () => {
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(['item1', 'item2']));
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should reject null data', () => {
      sessionStorage.setItem('hp_onboarding_draft', JSON.stringify(null));
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });
  });

  describe('Corrupt data handling', () => {
    it('should return null for invalid JSON', () => {
      sessionStorage.setItem('hp_onboarding_draft', '{invalid json}');
      const loaded = loadDraft();

      expect(loaded).toBeNull();
    });

    it('should continue working after corrupt data', () => {
      sessionStorage.setItem('hp_onboarding_draft', '{invalid}');
      loadDraft(); // Should not throw

      clearDraft();
      saveDraft({ name: 'After Corrupt', smsNumber: '' } as any);
      const loaded = loadDraft();

      expect(loaded?.name).toBe('After Corrupt');
    });
  });
});
