import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import Onboarding from '../pages/Onboarding';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    submitCareerApplication: vi.fn(),
    importOAuthPhoto: vi.fn(),
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

// Mock LocationAutocomplete — typing calls onChange(text), selecting calls onChange(text, lat, lng, nbhd)
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

/**
 * Helper: advance past the welcome step by clicking "Get started"
 */
async function goToSkillsStep() {
  // Wait for profile to load (skeleton disappears, welcome step appears)
  await waitFor(() => {
    expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
  });
  // Click "Get started" to move to location step
  fireEvent.click(screen.getByText('onboarding.getStarted'));
  // Now on location step — click continue/skip to go to skills
  await waitFor(() => {
    expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('onboarding.skipLocation'));
  // Now on skills step
  await waitFor(() => {
    expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
  });
}

describe('Onboarding', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetApplyIntent.mockReturnValue(null);
    mockClearApplyIntent.mockClear();
    mockGetListingApplyIntent.mockReturnValue(null);
    mockClearListingApplyIntent.mockClear();

    // Set up default mocks
    vi.mocked(api.getProfile).mockResolvedValue({
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
    } as any);
    vi.mocked(api.updateProfile).mockResolvedValue({} as any);
    vi.mocked(api.submitCareerApplication).mockResolvedValue({} as any);

    // Clean up localStorage
    localStorage.removeItem('linkedinHeadline');
    localStorage.removeItem('oauthPhotoUrl');
    localStorage.removeItem('oauthProvider');
    localStorage.removeItem('hp_onboarding_step');
    localStorage.removeItem('hp_onboarding_data');
  });

  describe('Wizard step navigation', () => {
    it('starts on the welcome step', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      // Benefits should be visible
      expect(screen.getByText('onboarding.benefit1')).toBeInTheDocument();
      expect(screen.getByText('onboarding.getStarted')).toBeInTheDocument();
    });

    it('navigates from welcome → location → skills', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      // Step 0 → 1: Welcome → Location
      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });

      // Step 1 → 2: Location → Skills (skip location)
      fireEvent.click(screen.getByText('onboarding.skipLocation'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });
    });

    it('can navigate back from skills → location', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Go back
      fireEvent.click(screen.getByText('common.back'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });
    });

    it('skip button navigates directly to dashboard from any step', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      const skipButton = screen.getByText('onboarding.skipToDashboard');
      fireEvent.click(skipButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Skills step', () => {
    it('renders skills and location on the skills step', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Popular skills are shown
      expect(screen.getByText('Content Writing')).toBeInTheDocument();
      expect(screen.getByText('Social Media Management')).toBeInTheDocument();
    });

    it('shows skill categories with collapsible sections', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Category headers are rendered
      expect(screen.getByText(/Local & In-Person/)).toBeInTheDocument();
      expect(screen.getByText(/Home & Personal Services/)).toBeInTheDocument();

      // Skills in collapsed categories are NOT visible
      expect(screen.queryByText('Pet Care')).not.toBeInTheDocument();
      expect(screen.queryByText('Mystery Shopping')).not.toBeInTheDocument();
    });

    it('can expand collapsed categories and select skills', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Expand "Home & Personal Services" category
      fireEvent.click(screen.getByText(/Home & Personal Services/));

      // Skills in expanded category should now be visible
      expect(screen.getByText('Pet Care')).toBeInTheDocument();
      expect(screen.getByText('Dog Walking')).toBeInTheDocument();

      // Select a skill
      const skillButton = screen.getByRole('button', { name: 'Pet Care' });
      fireEvent.click(skillButton);
      expect(skillButton.className).toContain('bg-blue-600');
    });

    it('can select skills from popular skills section', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Click a popular skill
      const popularButton = screen.getByRole('button', { name: 'Content Writing' });
      fireEvent.click(popularButton);

      // Skill should appear as selected chip
      const selectedChip = screen.getByRole('button', { name: /Content Writing/ });
      expect(selectedChip.className).toContain('bg-blue-600');
    });

    it('can add custom skill', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      const customSkillInput = screen.getByPlaceholderText('onboarding.step2.addCustomSkill');
      fireEvent.change(customSkillInput, {
        target: { value: 'custom-skill' },
      });

      const addButton = screen.getByRole('button', { name: 'onboarding.step2.add' });
      fireEvent.click(addButton);

      expect(screen.getByText(/custom-skill/i)).toBeInTheDocument();
    });
  });

  describe('Location step', () => {
    it('shows location as optional with helper text', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      // Navigate to location step
      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.locationOptional')).toBeInTheDocument();
      });
    });

    it('shows amber hint when location is typed but not selected from dropdown', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });

      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'manila' } });

      expect(screen.getByText('onboarding.step2.locationHint')).toBeInTheDocument();
    });

    it('shows green checkmark when location is selected from dropdown', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-location'));

      // Location should show with green checkmark
      expect(screen.getByText('New York, NY, United States')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('disables submit button when no skills selected', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      const submitButton = screen.getByRole('button', { name: /onboarding.completeProfile/i });
      expect(submitButton).toBeDisabled();
    });

    it('completes with skills only (no location needed)', async () => {
      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      // Select a skill
      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({
        skills: ['Content Writing'],
      });
    });

    it('completes with both location and skills', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });

      // Navigate to location
      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });

      // Select location
      fireEvent.click(screen.getByTestId('select-location'));

      // Continue to skills (location auto-saves to backend)
      fireEvent.click(screen.getByText('onboarding.continue'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Select a skill
      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      // Final submit should include location + skills
      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'New York, NY, United States',
          locationLat: 40.7,
          locationLng: -74.0,
          skills: ['Content Writing'],
        })
      );
    });

    it('shows error when API call fails', async () => {
      vi.mocked(api.updateProfile).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<Onboarding />);
      await goToSkillsStep();

      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));
      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Step persistence', () => {
    it('resumes from saved step when returning', async () => {
      // Simulate previously saved wizard state at the skills step (step 2 for 3-step wizard)
      localStorage.setItem('hp_onboarding_step', '2');
      localStorage.setItem('hp_onboarding_data', JSON.stringify({
        skills: ['Content Writing'],
        location: 'Lagos, Nigeria',
        locationLat: 6.5,
        locationLng: 3.4,
      }));

      renderWithProviders(<Onboarding />);

      // Should resume at skills step with pre-filled data
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Pre-filled skill should be selected
      const selectedChip = screen.getByRole('button', { name: /Content Writing/ });
      expect(selectedChip.className).toContain('bg-blue-600');
    });
  });

  describe('LinkedIn headline skill matching', () => {
    it('pre-selects skills based on LinkedIn headline and expands relevant categories', async () => {
      localStorage.setItem('linkedinHeadline', 'Software Engineer at Acme Corp');

      renderWithProviders(<Onboarding />);

      // Navigate to skills step
      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('onboarding.getStarted'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.location')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('onboarding.skipLocation'));
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Development & Tech category should be auto-expanded (contains matched skills)
      expect(screen.getAllByText('Software Development').length).toBeGreaterThanOrEqual(1);

      // Matched skills should be pre-selected
      const swDevButtons = screen.getAllByRole('button', { name: 'Software Development' });
      const selectedBtn = swDevButtons.find((btn) => btn.className.includes('bg-blue-600'));
      expect(selectedBtn).toBeTruthy();
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
      await goToSkillsStep();

      // Select a skill and submit
      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));
      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      // Career application should have been auto-submitted
      expect(vi.mocked(api.submitCareerApplication)).toHaveBeenCalledWith({
        positionId: 'software-engineer',
        positionTitle: 'Software Engineer',
        about: 'Excited to contribute as a Software Engineer.',
        availability: 'flexible',
      });
      expect(mockClearApplyIntent).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('shows skeleton while profile is loading', async () => {
      // Make getProfile hang
      let resolveProfile: (value: any) => void;
      vi.mocked(api.getProfile).mockReturnValue(new Promise((resolve) => {
        resolveProfile = resolve;
      }));

      renderWithProviders(<Onboarding />);

      // Skeleton should be visible (animate-pulse elements)
      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBeGreaterThan(0);

      // Resolve profile
      resolveProfile!({
        id: 'test-id',
        name: 'Test User',
        email: 'test@example.com',
      });

      // Welcome step should appear
      await waitFor(() => {
        expect(screen.getByText('onboarding.welcomeTitle')).toBeInTheDocument();
      });
    });
  });
});
