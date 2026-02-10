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
  },
}));

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: {
    identify: vi.fn(),
    track: vi.fn(),
  },
}));

// Mock LocationAutocomplete to behave like a simple input
vi.mock('../components/LocationAutocomplete', () => ({
  default: ({ id, value, onChange, placeholder }: any) => (
    <input
      id={id}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder={placeholder}
    />
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

    // Set up default mocks
    vi.mocked(api.getProfile).mockResolvedValue({
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
    } as any);
    vi.mocked(api.updateProfile).mockResolvedValue({} as any);
  });

  it('renders single-step with skills and location', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('onboarding.step2.locationPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('Local Photography')).toBeInTheDocument();
  });

  it('shows skill selection with suggestions', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    expect(screen.getByText('Local Photography')).toBeInTheDocument();
    expect(screen.getByText('Phone Calls')).toBeInTheDocument();
    expect(screen.getByText('Package Pickup & Delivery')).toBeInTheDocument();
    expect(screen.getByText('Pet Care')).toBeInTheDocument();
    expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
  });

  it('can select skills', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    const skillButton = screen.getByRole('button', { name: 'Local Photography' });
    fireEvent.click(skillButton);

    expect(skillButton.className).toContain('bg-blue-600');
  });

  it('skip button navigates to dashboard', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    const skipButton = screen.getByText('onboarding.skipToDashboard');
    fireEvent.click(skipButton);

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

  describe('Validation', () => {
    it('shows error when location is missing', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Select a skill but don't fill location
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorLocation')).toBeInTheDocument();
      });
    });

    it('shows error when no skills selected', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      // Fill location but don't select skills
      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorSkills')).toBeInTheDocument();
      });
    });

    it('shows combined error when both are missing', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorBoth')).toBeInTheDocument();
      });
    });

    it('completes and navigates to dashboard when both filled', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({
        location: 'New York',
        skills: ['Pet Care'],
      });
    });

    it('shows error when API call fails', async () => {
      vi.mocked(api.updateProfile).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      fireEvent.click(screen.getByRole('button', { name: /onboarding.completeProfile/i }));

      await waitFor(() => {
        expect(screen.getByText('common.error')).toBeInTheDocument();
      });
    });
  });
});
