import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCvProcessing } from '../pages/onboarding/hooks/useCvProcessing';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('../lib/api', () => ({
  api: {
    uploadCvFile: vi.fn(),
    pollCvParse: vi.fn(),
  },
}));

vi.mock('../lib/posthog', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../pages/onboarding/utils', () => ({
  parseLanguageString: vi.fn((s: string) => ({
    language: s.split(' ')[0] || s,
    proficiency: 'Conversational',
  })),
}));

// Helper to create mock targets
function createMockTargets(overrides: Record<string, any> = {}) {
  return {
    setName: vi.fn(),
    setBio: vi.fn(),
    setLocation: vi.fn(),
    setSkills: vi.fn((fn: any) => (typeof fn === 'function' ? fn([]) : fn)),
    setLanguageEntries: vi.fn((fn: any) =>
      typeof fn === 'function' ? fn([]) : fn
    ),
    setEducationEntries: vi.fn((fn: any) =>
      typeof fn === 'function' ? fn([]) : fn
    ),
    setYearsOfExperience: vi.fn(),
    setLinkedinUrl: vi.fn(),
    setGithubUrl: vi.fn(),
    setTwitterUrl: vi.fn(),
    setWebsiteUrl: vi.fn(),
    getCurrentSocialUrls: vi.fn(() => ({
      linkedinUrl: '',
      githubUrl: '',
      twitterUrl: '',
      websiteUrl: '',
    })),
    setExternalProfiles: vi.fn((fn: any) =>
      typeof fn === 'function' ? fn([]) : fn
    ),
    mountedRef: { current: true },
    onFileSelected: vi.fn(),
    onCvFailed: vi.fn(),
    onParseComplete: vi.fn(),
    ...overrides,
  };
}

// Helper to create test files
function createTestFile(
  name = 'resume.pdf',
  type = 'application/pdf',
  size = 1024
) {
  return new File([new ArrayBuffer(size)], name, { type });
}

// Helper to create mock CV data in the format the hook expects
// Skills: { explicit: string[], inferred: string[] }
// Languages: string[] (e.g., "English (Native)")
// Education: { institution, degree, field, country, year }
function createGoodCvData(overrides: Record<string, any> = {}) {
  return {
    name: 'Jane Developer',
    bio: 'Full-stack developer with 5 years experience',
    location: 'Berlin, Germany',
    skills: { explicit: ['JavaScript', 'React', 'Node.js'], inferred: ['TypeScript'] },
    languages: ['English (Native)', 'German (Fluent)'],
    education: [{ institution: 'MIT', degree: 'BSc', field: 'Computer Science', country: 'US', year: 2018 }],
    yearsOfExperience: 5,
    linkedinUrl: 'https://linkedin.com/in/jane',
    githubUrl: 'https://github.com/jane',
    twitterUrl: '',
    websiteUrl: '',
    externalProfileUrls: [],
    certificates: [],
    ...overrides,
  };
}

/**
 * Helper: run processFile and advance fake timers until the async pipeline settles.
 * Handles retry delays (1.5s, 3s) and poll intervals (1.5s).
 */
async function processFileAndSettle(result: any, file: File) {
  await act(async () => {
    result.current.processFile(file);
  });
  // Advance through all retry delays (1.5s + 3s) and poll intervals (1.5s each × 40 max)
  // We advance in steps to let promises resolve between timer ticks
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
  }
}

describe('useCvProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Initial state ───

  describe('Initial state', () => {
    it('should have correct initial state: idle, not processing, not uploaded', () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));

      expect(result.current.cvStage).toBe('idle');
      expect(result.current.cvProcessing).toBe(false);
      expect(result.current.cvUploaded).toBe(false);
      expect(result.current.cvData).toBeNull();
    });

    it('should provide cvInputRef for file input binding', () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));

      expect(result.current.cvInputRef).toBeDefined();
      expect(result.current.cvInputRef.current).toBeNull();
    });
  });

  // ─── Stage 1: Client-side validation ───

  describe('Stage 1 — Client-side validation', () => {
    it('should reject .doc files with toast error and NOT call onFileSelected', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const docFile = createTestFile('resume.doc', 'application/msword', 1024);

      await act(async () => {
        result.current.processFile(docFile);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('.doc')
      );
      expect(targets.onFileSelected).not.toHaveBeenCalled();
      expect(result.current.cvStage).toBe('idle');
    });

    it('should reject non-PDF/Word files with toast error', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const txtFile = createTestFile('resume.txt', 'text/plain', 1024);

      await act(async () => {
        result.current.processFile(txtFile);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('PDF or Word')
      );
      expect(targets.onFileSelected).not.toHaveBeenCalled();
    });

    it('should reject files over 5MB with toast error', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const largeFile = createTestFile('resume.pdf', 'application/pdf', 6 * 1024 * 1024);

      await act(async () => {
        result.current.processFile(largeFile);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('5MB')
      );
      expect(targets.onFileSelected).not.toHaveBeenCalled();
    });

    it('should accept valid PDF file and call onFileSelected IMMEDIATELY', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      // Mock API to never resolve — we only care about the synchronous part
      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      // onFileSelected should be called BEFORE upload starts
      expect(targets.onFileSelected).toHaveBeenCalledTimes(1);
      expect(result.current.cvStage).toBe('uploading');
    });

    it('should accept valid .docx file and call onFileSelected', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const docxFile = createTestFile(
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        1024
      );

      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.processFile(docxFile);
      });

      expect(targets.onFileSelected).toHaveBeenCalled();
    });

    it('should accept file at exactly 5MB boundary', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const boundaryFile = createTestFile('resume.pdf', 'application/pdf', 5 * 1024 * 1024);

      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.processFile(boundaryFile);
      });

      expect(targets.onFileSelected).toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  // ─── Stage 2: Upload ───

  describe('Stage 2 — Upload', () => {
    it('should transition to uploading stage on processFile', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      expect(result.current.cvStage).toBe('uploading');
      expect(result.current.cvProcessing).toBe(true);
    });

    it('should transition to done on upload + parse success', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData(),
      });

      await processFileAndSettle(result, pdfFile);

      expect(result.current.cvStage).toBe('done');
    });

    it('should call onCvFailed and set cvStage to failed on upload failure after 3 retries', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('Upload failed'));

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('failed');
      expect(toast.error).toHaveBeenCalled();
    });

    it('should retry upload up to 3 times before failing', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('Upload failed'));

      await processFileAndSettle(result, pdfFile);

      expect(vi.mocked(api.uploadCvFile)).toHaveBeenCalledTimes(3);
    });

    it('should succeed on second retry attempt', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile)
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({ fileId: 'cv-123' });

      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData(),
      });

      await processFileAndSettle(result, pdfFile);

      expect(result.current.cvStage).toBe('done');
      expect(targets.onCvFailed).not.toHaveBeenCalled();
    });
  });

  // ─── Stage 3: Parsing ───

  describe('Stage 3 — Parsing', () => {
    it('should poll until status=complete and apply data', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData();

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse)
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(result.current.cvStage).toBe('done');
      expect(result.current.cvUploaded).toBe(true);
      expect(result.current.cvData).toEqual(mockData);
    });

    it('should handle poll returning status=failed', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'failed',
        error: 'Failed to parse CV',
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('failed');
    });

    it('should timeout after max polling attempts and call onCvFailed', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      // Always return pending — will exceed PARSE_POLL_MAX_ATTEMPTS (40)
      vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'pending' });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('failed');
      // Should have polled exactly 40 times
      expect(vi.mocked(api.pollCvParse).mock.calls.length).toBe(40);
    });
  });

  // ─── Data quality validation ───

  describe('Data quality validation', () => {
    it('should reject CV with 0 skills and no name (not a CV message)', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: { skills: { explicit: [], inferred: [] } },
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalledWith(
        expect.stringContaining("doesn't appear to be a CV")
      );
      expect(result.current.cvStage).toBe('failed');
    });

    it('should reject CV with 1 skill (below threshold of 2)', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: { name: 'Someone', skills: { explicit: ['Writing'], inferred: [] } },
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalledWith(
        expect.stringContaining("couldn't find enough skills")
      );
      expect(result.current.cvStage).toBe('failed');
    });

    it('should accept CV with exactly 2 skills (at threshold)', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData({ skills: { explicit: ['JavaScript', 'React'], inferred: [] } }),
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).not.toHaveBeenCalled();
      expect(result.current.cvStage).toBe('done');
    });

    it('should count explicit + inferred skills together for threshold', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData({ skills: { explicit: ['JavaScript'], inferred: ['React'] } }),
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).not.toHaveBeenCalled();
      expect(result.current.cvStage).toBe('done');
    });

    it('should accept CV with skills but no name (skills are the primary signal)', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData({ name: '' }),
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).not.toHaveBeenCalled();
      expect(result.current.cvStage).toBe('done');
    });

    it('should reject null parse result', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: null,
      });

      await processFileAndSettle(result, pdfFile);

      expect(targets.onCvFailed).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('failed');
    });
  });

  // ─── Data application (applyParsedCvData) ───

  describe('Data application (applyParsedCvData)', () => {
    it('should apply name, bio, and location to form', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        name: 'Jane Smith',
        bio: 'Full-stack developer',
        location: 'New York, NY',
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setName).toHaveBeenCalledWith('Jane Smith');
      expect(targets.setBio).toHaveBeenCalledWith('Full-stack developer');
      expect(targets.setLocation).toHaveBeenCalledWith('New York, NY');
    });

    it('should merge skills with case-insensitive deduplication', async () => {
      const targets = createMockTargets();
      // setSkills receives a function — execute it with existing skills
      targets.setSkills.mockImplementation((fn: any) => {
        if (typeof fn === 'function') return fn(['javascript', 'Python']);
      });

      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        skills: { explicit: ['JavaScript', 'React'], inferred: ['Python'] },
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setSkills).toHaveBeenCalled();
      // Find the updater function call
      const updaterCall = targets.setSkills.mock.calls.find(
        (call: any[]) => typeof call[0] === 'function'
      );
      expect(updaterCall).toBeDefined();
      // Execute updater with existing skills to verify dedup
      const merged = updaterCall![0](['javascript', 'Python']);
      // 'JavaScript' should NOT duplicate 'javascript', 'Python' should NOT duplicate
      // Only 'React' should be added
      expect(merged).toContain('javascript');
      expect(merged).toContain('Python');
      expect(merged).toContain('React');
      expect(merged).toHaveLength(3); // javascript, Python, React (no dupes)
    });

    it('should only fill social URLs if currently empty', async () => {
      const targets = createMockTargets({
        getCurrentSocialUrls: vi.fn(() => ({
          linkedinUrl: '',
          githubUrl: '',
          twitterUrl: '',
          websiteUrl: '',
        })),
      });

      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        linkedinUrl: 'https://linkedin.com/in/jane',
        githubUrl: 'https://github.com/jane',
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setLinkedinUrl).toHaveBeenCalledWith('https://linkedin.com/in/jane');
      expect(targets.setGithubUrl).toHaveBeenCalledWith('https://github.com/jane');
    });

    it('should not overwrite existing social URLs', async () => {
      const targets = createMockTargets({
        getCurrentSocialUrls: vi.fn(() => ({
          linkedinUrl: 'https://linkedin.com/in/existing',
          githubUrl: '',
          twitterUrl: '',
          websiteUrl: '',
        })),
      });

      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        linkedinUrl: 'https://linkedin.com/in/new',
        githubUrl: 'https://github.com/jane',
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      // Should NOT overwrite existing LinkedIn URL
      expect(targets.setLinkedinUrl).not.toHaveBeenCalled();
      // Should set empty GitHub URL
      expect(targets.setGithubUrl).toHaveBeenCalledWith('https://github.com/jane');
    });

    it('should show success toast with sections count', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({
        status: 'complete',
        data: createGoodCvData(),
      });

      await processFileAndSettle(result, pdfFile);

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('sections auto-filled')
      );
    });

    it('should set cvUploaded=true and cvData after successful parse', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData();

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(result.current.cvUploaded).toBe(true);
      expect(result.current.cvData).toEqual(mockData);
    });

    it('should apply yearsOfExperience from parsed data', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({ yearsOfExperience: 7 });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setYearsOfExperience).toHaveBeenCalledWith(7);
    });

    it('should apply language entries from parsed data', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        languages: ['English (Native)', 'French (Fluent)'],
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setLanguageEntries).toHaveBeenCalled();
    });

    it('should apply education entries from parsed data', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        education: [{ institution: 'Stanford', degree: 'MS', field: 'CS', country: 'US', year: 2021 }],
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      expect(targets.setEducationEntries).toHaveBeenCalled();
    });

    it('should strip personal info from bio (name, email, phone)', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData({
        name: 'Jane Smith',
        bio: 'Jane Smith is a developer. Contact: jane@example.com +1-555-0123',
      });

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      const bioCall = targets.setBio.mock.calls[0]?.[0] as string;
      expect(bioCall).toBeDefined();
      // Name, email, phone should be stripped
      expect(bioCall).not.toContain('Jane Smith');
      expect(bioCall).not.toContain('jane@example.com');
      expect(bioCall).not.toContain('555-0123');
    });
  });

  // ─── Full flow tests ───

  describe('Full happy path', () => {
    it('should complete full CV processing: select → upload → parse → apply → done', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      const mockData = createGoodCvData();

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: mockData });

      await processFileAndSettle(result, pdfFile);

      // Stage 1: onFileSelected should have fired immediately
      expect(targets.onFileSelected).toHaveBeenCalledTimes(1);

      // Stage 3: form should be populated
      expect(targets.setName).toHaveBeenCalledWith(mockData.name);
      expect(targets.setBio).toHaveBeenCalled();
      expect(targets.setLocation).toHaveBeenCalledWith(mockData.location);
      expect(targets.setSkills).toHaveBeenCalled();

      // Final callbacks and state
      expect(targets.onParseComplete).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('done');
      expect(result.current.cvUploaded).toBe(true);
    });
  });

  describe('Full failure path', () => {
    it('should handle full failure flow: select → upload fails → onCvFailed', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('Network error'));

      // Stage 1: fires immediately
      await act(async () => {
        result.current.processFile(pdfFile);
      });
      expect(targets.onFileSelected).toHaveBeenCalled();

      // Advance through retry delays (1.5s + 3s = 4.5s)
      for (let i = 0; i < 10; i++) {
        await act(async () => { vi.advanceTimersByTime(1600); });
      }

      expect(targets.onCvFailed).toHaveBeenCalled();
      expect(result.current.cvStage).toBe('failed');
      expect(result.current.cvUploaded).toBe(false);
    });
  });

  // ─── Unmount safety ───

  describe('Unmount safety', () => {
    it('should not call onCvFailed/onParseComplete after unmount during upload', async () => {
      const targets = createMockTargets();
      const { result, unmount } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      let uploadResolve: (value: any) => void;
      vi.mocked(api.uploadCvFile).mockImplementation(
        () => new Promise((resolve) => { uploadResolve = resolve; })
      );

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      // cvStage is 'uploading' at this point (set synchronously)
      expect(result.current.cvStage).toBe('uploading');

      // Unmount before upload completes
      unmount();
      targets.mountedRef.current = false;

      // Resolve upload — should NOT trigger further state updates
      await act(async () => {
        uploadResolve!({ fileId: 'cv-123' });
      });

      // onParseComplete should NOT have been called (component unmounted)
      expect(targets.onParseComplete).not.toHaveBeenCalled();
      expect(targets.onCvFailed).not.toHaveBeenCalled();
    });

    it('should not apply data if component unmounts during polling', async () => {
      const targets = createMockTargets();
      const { result, unmount } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });

      let pollResolve: (value: any) => void;
      vi.mocked(api.pollCvParse).mockImplementation(
        () => new Promise((resolve) => { pollResolve = resolve; })
      );

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      // Let upload complete and polling start
      await act(async () => { vi.advanceTimersByTime(100); });

      // Unmount during polling
      unmount();
      targets.mountedRef.current = false;

      // Resolve poll — should NOT apply data
      await act(async () => {
        pollResolve!({ status: 'complete', data: createGoodCvData() });
      });

      expect(targets.setName).not.toHaveBeenCalled();
      expect(targets.onParseComplete).not.toHaveBeenCalled();
    });
  });

  // ─── Helper methods ───

  describe('Helper methods', () => {
    it('should allow manually setting cvUploaded state', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));

      expect(result.current.cvUploaded).toBe(false);

      await act(async () => {
        result.current.setCvUploaded(true);
      });

      expect(result.current.cvUploaded).toBe(true);
    });

    it('should allow manually setting cvData state', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const mockData = { name: 'Test' };

      await act(async () => {
        result.current.setCvData(mockData);
      });

      expect(result.current.cvData).toEqual(mockData);
    });

    it('checkCvStatus should return current cvUploaded state', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));

      const status = await result.current.checkCvStatus();
      expect(status).toBe(false);

      await act(async () => {
        result.current.setCvUploaded(true);
      });

      const status2 = await result.current.checkCvStatus();
      expect(status2).toBe(true);
    });
  });

  // ─── Edge cases ───

  describe('Edge cases', () => {
    it('should prevent duplicate processFile calls while upload is in progress', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      // Second call should be a no-op
      await act(async () => {
        result.current.processFile(pdfFile);
      });

      expect(targets.onFileSelected).toHaveBeenCalledTimes(1);
      expect(vi.mocked(api.uploadCvFile)).toHaveBeenCalledTimes(1);
    });

    it('should handle CV data with missing optional fields gracefully', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);
      // Has 2 skills (meets threshold) but nothing else
      const minimalData = {
        skills: { explicit: ['JavaScript', 'React'], inferred: [] },
      };

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse).mockResolvedValueOnce({ status: 'complete', data: minimalData });

      await processFileAndSettle(result, pdfFile);

      // Should succeed — optional fields don't block acceptance
      expect(result.current.cvStage).toBe('done');
      expect(targets.setName).not.toHaveBeenCalled(); // no name in data
      expect(targets.setBio).not.toHaveBeenCalled(); // no bio
    });

    it('should clear file input value after processing starts', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));

      // Simulate a file input with a value
      const mockInput = { value: 'resume.pdf', click: vi.fn() };
      (result.current.cvInputRef as any).current = mockInput;

      vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      await act(async () => {
        result.current.processFile(pdfFile);
      });

      expect(mockInput.value).toBe('');
    });

    it('should handle network blips during polling without failing', async () => {
      const targets = createMockTargets();
      const { result } = renderHook(() => useCvProcessing(targets));
      const pdfFile = createTestFile('resume.pdf', 'application/pdf', 1024);

      vi.mocked(api.uploadCvFile).mockResolvedValueOnce({ fileId: 'cv-123' });
      vi.mocked(api.pollCvParse)
        .mockRejectedValueOnce(new Error('Network blip'))  // first poll fails
        .mockResolvedValueOnce({ status: 'pending' })       // second poll: still pending
        .mockResolvedValueOnce({ status: 'complete', data: createGoodCvData() }); // third poll: done

      await processFileAndSettle(result, pdfFile);

      // Should recover from the network blip and succeed
      expect(result.current.cvStage).toBe('done');
      expect(targets.onCvFailed).not.toHaveBeenCalled();
    });
  });
});
