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
vi.mock('../lib/applyIntent', () => ({
  getApplyIntent: () => mockGetApplyIntent(),
  clearApplyIntent: () => mockClearApplyIntent(),
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

describe('Onboarding', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetApplyIntent.mockReturnValue(null);
    mockClearApplyIntent.mockClear();

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
  });

  it('renders single-step with skills and location', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('onboarding.step2.locationPlaceholder')).toBeInTheDocument();
    // Default expanded categories: "Content & Writing" and "Marketing & Sales"
    expect(screen.getByText('Content Writing')).toBeInTheDocument();
    expect(screen.getByText('Social Media Management')).toBeInTheDocument();
  });

  it('shows skill categories with collapsible sections', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    // First 2 categories are expanded by default
    expect(screen.getByText('Content Writing')).toBeInTheDocument();
    expect(screen.getByText('Social Media Management')).toBeInTheDocument();

    // Collapsed categories show their names as buttons
    expect(screen.getByText(/Local Services/)).toBeInTheDocument();
    expect(screen.getByText(/Development & QA/)).toBeInTheDocument();

    // Skills in collapsed categories are NOT visible
    expect(screen.queryByText('Pet Care')).not.toBeInTheDocument();
    expect(screen.queryByText('Software Development')).not.toBeInTheDocument();
  });

  it('can expand collapsed categories and select skills', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    // Expand "Local Services" category
    fireEvent.click(screen.getByText(/Local Services/));

    // Skills in expanded category should now be visible
    expect(screen.getByText('Pet Care')).toBeInTheDocument();
    expect(screen.getByText('Package Delivery')).toBeInTheDocument();

    // Select a skill
    const skillButton = screen.getByRole('button', { name: 'Pet Care' });
    fireEvent.click(skillButton);
    expect(skillButton.className).toContain('bg-blue-600');
  });

  it('can select skills from default expanded categories', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    const skillButton = screen.getByRole('button', { name: 'Content Writing' });
    fireEvent.click(skillButton);

    expect(skillButton.className).toContain('bg-blue-600');
  });

  it('skip button navigates directly to dashboard (no confirmation dialog)', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    const skipButton = screen.getByText('onboarding.skipToDashboard');
    fireEvent.click(skipButton);

    // Should navigate directly — no confirmation dialog
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('can add custom skill', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    const customSkillInput = screen.getByPlaceholderText('onboarding.step2.addCustomSkill');
    fireEvent.change(customSkillInput, {
      target: { value: 'custom-skill' },
    });

    const addButton = screen.getByRole('button', { name: 'onboarding.step2.add' });
    fireEvent.click(addButton);

    expect(screen.getByText(/custom-skill/i)).toBeInTheDocument();
  });

  it('shows location as optional with helper text', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    // Location should be marked as optional
    expect(screen.getByText('onboarding.step2.locationOptional')).toBeInTheDocument();
  });

  describe('Validation', () => {
    it('shows error when no skills selected (location is optional)', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Submit without selecting skills or location — only skills error should show
      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorSkills')).toBeInTheDocument();
      });
    });

    it('completes with skills only (no location needed)', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Select a skill from an expanded category
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
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Select a location from the dropdown (provides lat/lng)
      fireEvent.click(screen.getByTestId('select-location'));
      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({
        location: 'New York, NY, United States',
        locationLat: 40.7,
        locationLng: -74.0,
        skills: ['Content Writing'],
      });
    });

    it('shows amber hint when location is typed but not selected from dropdown', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Type a location without selecting from the dropdown
      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'manila' } });

      // Hint text should be visible (amber, not blocking)
      expect(screen.getByText('onboarding.step2.locationHint')).toBeInTheDocument();

      // Submit button should NOT be disabled — location is optional now
      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));
      const submitButton = screen.getByRole('button', { name: /onboarding.completeProfile/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('shows error when API call fails', async () => {
      vi.mocked(api.updateProfile).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Content Writing' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('LinkedIn headline skill matching', () => {
    it('pre-selects skills based on LinkedIn headline and expands relevant categories', async () => {
      localStorage.setItem('linkedinHeadline', 'Software Engineer at Acme Corp');

      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Development & QA category should be expanded (contains matched skills)
      expect(screen.getByText('Software Development')).toBeInTheDocument();
      expect(screen.getByText('Code Review')).toBeInTheDocument();

      // Matched skills should be pre-selected (blue background)
      const swDevBtn = screen.getByRole('button', { name: 'Software Development' });
      expect(swDevBtn.className).toContain('bg-blue-600');
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
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

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
});
