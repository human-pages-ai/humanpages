import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import Onboarding from '../pages/onboarding';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

// ============================================================================
// MOCKS — matching exact patterns from Onboarding.test.tsx
// ============================================================================

vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadProfilePhoto: vi.fn(),
    importOAuthPhoto: vi.fn(),
    addEducation: vi.fn(),
    createService: vi.fn(),
    uploadCV: vi.fn(),
    uploadCvFile: vi.fn(),
    pollCvParse: vi.fn(),
    submitCareerApplication: vi.fn(),
    getLinkedInVerifyUrl: vi.fn(),
    getGitHubVerifyUrl: vi.fn(),
  },
  safeGetItem: vi.fn((key: string) => { try { return localStorage.getItem(key); } catch { return null; } }),
  safeSetItem: vi.fn((key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} }),
  safeRemoveItem: vi.fn((key: string) => { try { localStorage.removeItem(key); } catch {} }),
}));

vi.mock('../lib/safeStorage', () => {
  const store: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const makeMock = (s: Record<string, string>) => ({
    getItem: vi.fn((k: string) => s[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { s[k] = v; }),
    removeItem: vi.fn((k: string) => { delete s[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(s)) delete s[k]; }),
    isAvailable: vi.fn(() => true),
  });
  return {
    safeLocalStorage: makeMock(store),
    safeSessionStorage: makeMock(sessionStore),
    safeGetItem: vi.fn((k: string) => store[k] ?? null),
    safeSetItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    safeRemoveItem: vi.fn((k: string) => { delete store[k]; }),
  };
});

vi.mock('../lib/analytics', () => ({ analytics: { identify: vi.fn(), track: vi.fn() } }));
vi.mock('../lib/posthog', () => ({ posthog: { capture: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), promise: vi.fn() }),
}));

const mockGetApplyIntent = vi.fn();
const mockClearApplyIntent = vi.fn();
const mockGetListingApplyIntent = vi.fn();
const mockClearListingApplyIntent = vi.fn();
vi.mock('../lib/applyIntent', () => ({
  getApplyIntent: () => mockGetApplyIntent(),
  clearApplyIntent: () => mockClearApplyIntent(),
  getListingApplyIntent: () => mockGetListingApplyIntent(),
  clearListingApplyIntent: () => mockClearListingApplyIntent(),
}));

vi.mock('../components/LocationAutocomplete', () => ({
  default: ({ id, value, onChange, placeholder }: any) => (
    <div>
      <input id={id} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} />
      <button data-testid="select-location" onClick={() => onChange('New York, NY, United States', 40.7, -74.0, '')}>Select Location</button>
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ============================================================================
// TEST DATA
// ============================================================================

const goodCvData = {
  name: 'Jane Developer',
  bio: 'Full-stack developer with 5 years experience',
  location: 'Berlin, Germany',
  skills: { explicit: ['JavaScript', 'React', 'Node.js'], inferred: ['TypeScript', 'CSS'] },
  education: [{ institution: 'MIT', degree: 'BSc', field: 'Computer Science', country: 'US', year: 2018 }],
  languages: ['English (Native)', 'German (Fluent)'],
  yearsOfExperience: 5,
  linkedinUrl: 'https://linkedin.com/in/jane',
  githubUrl: 'https://github.com/jane',
  twitterUrl: '',
  websiteUrl: '',
  externalProfileUrls: [],
  certificates: [],
};

const sparseCvData = {
  name: 'Someone',
  skills: { explicit: [], inferred: ['Writing'] }, // 1 skill — below threshold of 2
};

// ============================================================================
// HELPERS
// ============================================================================

/** Render the Onboarding wizard starting on the cv-upload step */
async function renderOnCvUploadStep() {
  window.history.pushState({}, '', '?step=cv-upload');
  renderWithProviders(<Onboarding />);
  await waitFor(() => {
    expect(screen.getByText('onboarding.cvUpload.heading')).toBeInTheDocument();
  });
}

/** Trigger a file upload via the hidden file input */
function uploadFile(file: File) {
  const input = document.querySelector('input[type="file"][accept*="pdf"]') as HTMLInputElement;
  if (!input) throw new Error('File input not found');
  fireEvent.change(input, { target: { files: [file] } });
}

function createMockFile(name: string, type: string): File {
  return new File(['mock content'], name, { type });
}

/** Long timeout for tests involving retry delays (1.5s + 3s between retries) */
const RETRY_TIMEOUT = 15000;

// ============================================================================
// TESTS
// ============================================================================

describe('CV Upload — 3-Stage Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use REAL timers — fake timers deadlock with waitFor()
    vi.mocked(api.getProfile).mockResolvedValue({} as any);
    vi.mocked(api.updateProfile).mockResolvedValue({} as any);
    mockGetApplyIntent.mockReturnValue(null);
    mockGetListingApplyIntent.mockReturnValue(null);
  });

  // ─── Stage 1: Immediate advance on file selection ───

  it('should advance to equipment step immediately after selecting a valid CV file', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-1' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    // Navigation to equipment should happen instantly (stage 1: before upload starts)
    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });

    expect(screen.getByText('onboarding.equipment.heading')).toBeInTheDocument();
  });

  // ─── Stage 2: Upload failure reverts to cv-upload ───

  it('should revert to cv-upload when upload fails after all retries', async () => {
    vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('Network error'));

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    // First advances to equipment (stage 1 immediate)
    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });

    // After retries exhaust (~4.5s), reverts to cv-upload
    await waitFor(() => {
      expect(window.location.search).toContain('step=cv-upload');
    }, { timeout: RETRY_TIMEOUT });

    expect(toast.error).toHaveBeenCalled();
  }, RETRY_TIMEOUT);

  // ─── Stage 3: Parse failure reverts to cv-upload ───

  it('should revert to cv-upload when CV parsing fails', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-3' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'failed' });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });

    // Parse failure triggers revert
    await waitFor(() => {
      expect(window.location.search).toContain('step=cv-upload');
    }, { timeout: RETRY_TIMEOUT });

    expect(toast.error).toHaveBeenCalled();
  }, RETRY_TIMEOUT);

  // ─── Data quality rejection ───

  it('should revert when CV data is too sparse (below skill threshold)', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-4' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: sparseCvData });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });

    await waitFor(() => {
      expect(window.location.search).toContain('step=cv-upload');
    }, { timeout: RETRY_TIMEOUT });

    expect(toast.error).toHaveBeenCalled();
  }, RETRY_TIMEOUT);

  // ─── Happy path ───

  it('should stay on equipment after successful CV upload and parse', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-5' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });

    // Wait for parse to complete and verify we DON'T revert
    await waitFor(() => {
      expect(screen.getByText('onboarding.equipment.heading')).toBeInTheDocument();
    });

    // Success toast should fire
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('sections auto-filled'));
    }, { timeout: RETRY_TIMEOUT });
  }, RETRY_TIMEOUT);

  // ─── Progress preservation: failure → re-upload returns to saved step ───

  it('should return to equipment when re-uploading after a failure', async () => {
    // First upload: all 3 retries fail
    vi.mocked(api.uploadCvFile)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      // Re-upload succeeds
      .mockResolvedValueOnce({ fileId: 'f-6-retry' });

    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();

    // First upload — advances to equipment, then fails and reverts
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));
    await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });
    await waitFor(() => { expect(window.location.search).toContain('step=cv-upload'); }, { timeout: RETRY_TIMEOUT });

    // Re-upload — should return to equipment (saved by returnToStepRef)
    uploadFile(createMockFile('resume_v2.pdf', 'application/pdf'));
    await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });
  }, RETRY_TIMEOUT * 2);

  // ─── Flow revert: failure puts skills back in position 3 ───

  it('should revert to NO_CV flow on failure so skip goes to skills', async () => {
    vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('fail'));

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    // Wait for revert
    await waitFor(() => { expect(window.location.search).toContain('step=cv-upload'); }, { timeout: RETRY_TIMEOUT });

    // Skip — in NO_CV flow, next step after cv-upload is skills
    fireEvent.click(screen.getByText('common.skipForNow'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=skills');
    });
  }, RETRY_TIMEOUT);

  // ─── Skip CV → NO_CV flow (no upload attempted) ───

  it('should go to skills step when user skips CV upload', async () => {
    await renderOnCvUploadStep();

    fireEvent.click(screen.getByText('common.skipForNow'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=skills');
      expect(screen.getByText('onboarding.skills.heading')).toBeInTheDocument();
    });
  });

  // ─── Upload indicator ───

  it('should show "Uploading your CV..." while upload is in progress', async () => {
    // Upload never resolves
    vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {}));

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(screen.getByText('Uploading your CV...')).toBeInTheDocument();
    });
  });

  // ─── Parsing indicator ───

  it('should show "Analyzing your CV..." while parsing is in progress', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-10' });
    // Poll never resolves
    vi.mocked(api.pollCvParse).mockImplementation(() => new Promise(() => {}));

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => {
      expect(screen.getByText('Analyzing your CV...')).toBeInTheDocument();
    });
  });

  // ─── Client-side validation: invalid file type ───

  it('should reject invalid file types and stay on cv-upload', async () => {
    await renderOnCvUploadStep();
    uploadFile(createMockFile('notes.txt', 'text/plain'));

    expect(screen.getByText('onboarding.cvUpload.heading')).toBeInTheDocument();
    expect(vi.mocked(api.uploadCvFile)).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  // ─── Client-side validation: .doc rejected ───

  it('should reject legacy .doc files', async () => {
    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.doc', 'application/msword'));

    expect(vi.mocked(api.uploadCvFile)).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('.doc'));
  });

  // ─── Client-side validation: .docx accepted ───

  it('should accept .docx files', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-docx' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });
  });

  // ─── Client-side validation: file too large ───

  it('should reject files over 5MB', async () => {
    await renderOnCvUploadStep();
    uploadFile(new File([new ArrayBuffer(6 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('5MB'));
    expect(vi.mocked(api.uploadCvFile)).not.toHaveBeenCalled();
  });

  // ─── Drag-and-drop ───

  it('should support drag-and-drop file upload', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-dnd' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();

    const dropArea = screen.getByLabelText('Upload your CV (PDF or Word document)');
    fireEvent.drop(dropArea, { dataTransfer: { files: [createMockFile('resume.pdf', 'application/pdf')] } });

    await waitFor(() => {
      expect(window.location.search).toContain('step=equipment');
    });
  });

  // ─── CV with no name but good skills is accepted ───

  it('should accept CV with no name but sufficient skills', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-noname' });
    vi.mocked(api.pollCvParse).mockResolvedValue({
      status: 'complete',
      data: { ...goodCvData, name: '' },
    });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });

    // Should NOT revert — skills met threshold
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    }, { timeout: RETRY_TIMEOUT });
    expect(window.location.search).toContain('step=equipment');
  }, RETRY_TIMEOUT);

  // ─── Upload recovers on second retry ───

  it('should succeed when upload works on second attempt', async () => {
    vi.mocked(api.uploadCvFile)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ fileId: 'f-retry' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();
    uploadFile(createMockFile('resume.pdf', 'application/pdf'));

    // Should end on equipment after retry succeeds
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    }, { timeout: RETRY_TIMEOUT });
    expect(window.location.search).toContain('step=equipment');
  }, RETRY_TIMEOUT);

  // ─── Duplicate uploads are blocked ───

  it('should only process the first upload when file input is triggered twice before navigation', async () => {
    vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-dup' });
    vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

    await renderOnCvUploadStep();

    // Get the file input before navigation happens
    const input = document.querySelector('input[type="file"][accept*="pdf"]') as HTMLInputElement;

    // Fire change on the same input twice synchronously
    const file1 = createMockFile('resume1.pdf', 'application/pdf');
    const file2 = createMockFile('resume2.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file1] } });
    fireEvent.change(input, { target: { files: [file2] } });

    await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });

    // cvUploadingRef blocks the second processFile call — only 1 upload
    expect(vi.mocked(api.uploadCvFile)).toHaveBeenCalledTimes(1);
  });
});
