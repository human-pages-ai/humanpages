import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import Onboarding from '../pages/onboarding';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadProfilePhoto: vi.fn(),
    importOAuthPhoto: vi.fn(),
    addEducation: vi.fn(),
    createService: vi.fn(),
    uploadCV: vi.fn(),
    uploadCvFile: vi.fn().mockResolvedValue({ fileId: 'test-file-id' }),
    pollCvParse: vi.fn().mockResolvedValue({ status: 'complete', data: { name: 'Test', skills: { explicit: ['JavaScript'], inferred: ['React'] } } }),
    submitCareerApplication: vi.fn(),
    getLinkedInVerifyUrl: vi.fn(),
    getGitHubVerifyUrl: vi.fn(),
  },
  safeGetItem: vi.fn((key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  }),
  safeSetItem: vi.fn((key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }),
  safeRemoveItem: vi.fn((key: string) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }),
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

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: {
    identify: vi.fn(),
    track: vi.fn(),
  },
}));

// Mock posthog
vi.mock('../lib/posthog', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

// Mock applyIntent
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

// Mock LocationAutocomplete
vi.mock('../components/LocationAutocomplete', () => ({
  default: ({ id, value, onChange, placeholder }: any) => (
    <div>
      <input
        id={id}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        data-testid="select-location"
        onClick={() => onChange('New York, NY, United States', 40.7, -74.0, '')}
      >
        Select Location
      </button>
    </div>
  ),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Onboarding', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetApplyIntent.mockReturnValue(null);
    mockClearApplyIntent.mockClear();
    mockGetListingApplyIntent.mockReturnValue(null);
    mockClearListingApplyIntent.mockClear();

    vi.mocked(api.getProfile).mockResolvedValue({
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
    } as any);
    vi.mocked(api.updateProfile).mockResolvedValue({} as any);
    vi.mocked(api.createService).mockResolvedValue({} as any);
    vi.mocked(api.submitCareerApplication).mockResolvedValue({} as any);
  });

  describe('Step 1 — Identity', () => {
    it('starts on step 1 with profile fields', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Short Bio')).toBeInTheDocument();
    });

    it('pre-fills name from profile', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name')).toHaveValue('Test User');
      });
    });

    it('requires name to continue', async () => {
      vi.mocked(api.getProfile).mockResolvedValue({ id: 'test-id', email: 'test@example.com' } as any);
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });

      // Clear name and submit
      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Continue to Skills'));

      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('advances to step 2 on submit', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continue to Skills'));

      await waitFor(() => {
        expect(screen.getByText('What can you do?')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2 — Skills', () => {
    async function goToStep2() {
      renderWithProviders(<Onboarding />);
      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Continue to Skills'));
      await waitFor(() => {
        expect(screen.getByText('What can you do?')).toBeInTheDocument();
      });
    }

    it('shows popular skills', async () => {
      await goToStep2();

      expect(screen.getByText('Content Writing')).toBeInTheDocument();
      expect(screen.getByText('Social Media Management')).toBeInTheDocument();
    });

    it('shows skill categories with collapsible sections', async () => {
      await goToStep2();

      expect(screen.getByText(/Local & In-Person/)).toBeInTheDocument();
      expect(screen.getByText(/Home & Personal Services/)).toBeInTheDocument();

      // Skills in collapsed categories are NOT visible
      expect(screen.queryByText('Pet Care')).not.toBeInTheDocument();
      expect(screen.queryByText('Mystery Shopping')).not.toBeInTheDocument();
    });

    it('can expand categories and select skills', async () => {
      await goToStep2();

      fireEvent.click(screen.getByText(/Home & Personal Services/));

      expect(screen.getByText('Pet Care')).toBeInTheDocument();
      expect(screen.getByText('Dog Walking')).toBeInTheDocument();
    });

    it('can add custom skill', async () => {
      await goToStep2();

      const customSkillInput = screen.getByPlaceholderText('Add custom skill...');
      fireEvent.change(customSkillInput, { target: { value: 'Basket Weaving' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(screen.getByText('Basket Weaving')).toBeInTheDocument();
    });

    it('can navigate back to step 1', async () => {
      await goToStep2();

      fireEvent.click(screen.getByText('← Back to previous step'));

      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });
    });
  });

  describe('Step 3 — Service', () => {
    async function goToStep3() {
      renderWithProviders(<Onboarding />);
      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Continue to Skills'));
      await waitFor(() => {
        expect(screen.getByText('What can you do?')).toBeInTheDocument();
      });
      // Select a skill to enable submit
      fireEvent.click(screen.getByText('Content Writing'));
      fireEvent.click(screen.getByText('Continue to Service'));
      await waitFor(() => {
        expect(screen.getByText('Offer your first service')).toBeInTheDocument();
      });
    }

    it('shows service form fields', async () => {
      await goToStep3();

      expect(screen.getByLabelText('Service Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('can skip step 3', async () => {
      await goToStep3();

      fireEvent.click(screen.getByText('Skip for now'));

      await waitFor(() => {
        expect(screen.getByText('Build trust')).toBeInTheDocument();
      });
    });
  });

  describe('Step 4 — Verify', () => {
    async function goToStep4() {
      renderWithProviders(<Onboarding />);
      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Continue to Skills'));
      await waitFor(() => {
        expect(screen.getByText('What can you do?')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Content Writing'));
      fireEvent.click(screen.getByText('Continue to Service'));
      await waitFor(() => {
        expect(screen.getByText('Offer your first service')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Skip for now'));
      await waitFor(() => {
        expect(screen.getByText('Build trust')).toBeInTheDocument();
      });
    }

    it('shows verification options', async () => {
      await goToStep4();

      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('Crypto Wallet')).toBeInTheDocument();
    });

    it('navigates to dashboard on completion', async () => {
      await goToStep4();

      fireEvent.click(screen.getByText(/Go to Dashboard/));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Validation', () => {
    it('shows error when step 2 API call fails', async () => {
      vi.mocked(api.updateProfile)
        .mockResolvedValueOnce({} as any) // step 1 succeeds
        .mockRejectedValueOnce(new Error('Network error')); // step 2 fails

      renderWithProviders(<Onboarding />);
      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continue to Skills'));
      await waitFor(() => {
        expect(screen.getByText('What can you do?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Content Writing'));
      fireEvent.click(screen.getByText('Continue to Service'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-submit application after onboarding', () => {
    it('auto-submits career application when apply intent exists', async () => {
      mockGetApplyIntent.mockReturnValue({
        positionId: 'software-engineer',
        positionTitle: 'Software Engineer',
        timestamp: Date.now(),
      });

      renderWithProviders(<Onboarding />);
      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });

      // Step 1
      fireEvent.click(screen.getByText('Continue to Skills'));
      await waitFor(() => { expect(screen.getByText('What can you do?')).toBeInTheDocument(); });

      // Step 2
      fireEvent.click(screen.getByText('Content Writing'));
      fireEvent.click(screen.getByText('Continue to Service'));
      await waitFor(() => { expect(screen.getByText('Offer your first service')).toBeInTheDocument(); });

      // Step 3 skip
      fireEvent.click(screen.getByText('Skip for now'));
      await waitFor(() => { expect(screen.getByText('Build trust')).toBeInTheDocument(); });

      // Step 4 complete
      fireEvent.click(screen.getByText(/Go to Dashboard/));

      await waitFor(() => {
        expect(vi.mocked(api.submitCareerApplication)).toHaveBeenCalledWith({
          positionId: 'software-engineer',
          positionTitle: 'Software Engineer',
          about: 'Excited to contribute as a Software Engineer.',
          availability: 'flexible',
        });
      });
      expect(mockClearApplyIntent).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('shows step 1 after profile loads', async () => {
      let resolveProfile: (value: any) => void;
      vi.mocked(api.getProfile).mockReturnValue(new Promise((resolve) => {
        resolveProfile = resolve;
      }));

      renderWithProviders(<Onboarding />);

      // Resolve profile
      resolveProfile!({
        id: 'test-id',
        name: 'Test User',
        email: 'test@example.com',
      });

      await waitFor(() => {
        expect(screen.getByText("Let's get to know you")).toBeInTheDocument();
      });
    });
  });
});
