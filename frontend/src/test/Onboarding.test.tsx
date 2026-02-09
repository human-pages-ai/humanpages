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

// Mock PhoneInput to behave like a simple input
vi.mock('../components/PhoneInput', () => ({
  default: ({ id, value, onChange }: { id: string; value: string; onChange: (val: string) => void }) => (
    <input
      id={id}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder="onboarding.step1.whatsappPlaceholder"
    />
  ),
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

// Helper to advance to step 2
async function goToStep2() {
  await waitFor(() => {
    expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
  });
  const input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
  fireEvent.change(input, { target: { value: 'contact@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));
  await waitFor(() => {
    expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
  });
}

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

  it('renders step 1 (contact method)', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'onboarding.step1.email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'onboarding.step1.telegram' })).toBeInTheDocument();
  });

  it('can type in contact value', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
    fireEvent.change(input, { target: { value: 'contact@example.com' } });

    expect(input).toHaveValue('contact@example.com');
  });

  it('progresses to step 2 on submit', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });

    // Fill in contact value
    const input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
    fireEvent.change(input, { target: { value: 'contact@example.com' } });

    // Submit step 1
    const continueButton = screen.getByRole('button', { name: /onboarding.continue/i });
    fireEvent.click(continueButton);

    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({ contactEmail: 'contact@example.com' });
  });

  it('step 2 shows skill selection with updated suggestions', async () => {
    renderWithProviders(<Onboarding />);
    await goToStep2();

    // Check new skill buttons exist
    expect(screen.getByText('Local Photography')).toBeInTheDocument();
    expect(screen.getByText('Phone Calls')).toBeInTheDocument();
    expect(screen.getByText('Package Pickup & Delivery')).toBeInTheDocument();
    expect(screen.getByText('Pet Care')).toBeInTheDocument();
    expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
  });

  it('can select skills in step 2', async () => {
    renderWithProviders(<Onboarding />);
    await goToStep2();

    // Check that skill buttons are available
    const skillButton = screen.getByRole('button', { name: 'Local Photography' });
    expect(skillButton).toBeInTheDocument();

    // Click a skill button
    fireEvent.click(skillButton);

    // Skills should be selected (button class changes)
    expect(skillButton.className).toContain('bg-blue-600');
  });

  it('skip button navigates to dashboard', async () => {
    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });

    // Click skip to dashboard button
    const skipButton = screen.getByText('onboarding.skipToDashboard');
    fireEvent.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('can add custom skill in step 2', async () => {
    renderWithProviders(<Onboarding />);
    await goToStep2();

    // Add a custom skill
    const customSkillInput = screen.getByPlaceholderText('onboarding.step2.addCustomSkill');
    fireEvent.change(customSkillInput, {
      target: { value: 'custom-skill' },
    });

    const addButton = screen.getByRole('button', { name: 'onboarding.step2.add' });
    fireEvent.click(addButton);

    // The custom skill should appear in the selected list
    expect(screen.getByText(/custom-skill/i)).toBeInTheDocument();
  });

  describe('WhatsApp validation', () => {
    it('shows error for invalid WhatsApp number', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
      });

      // Select WhatsApp
      fireEvent.click(screen.getByRole('button', { name: 'onboarding.step1.whatsapp' }));

      // Enter invalid number
      const input = screen.getByPlaceholderText('onboarding.step1.whatsappPlaceholder');
      fireEvent.change(input, { target: { value: '12345' } });

      // Try to continue
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('onboarding.step1.errorWhatsapp')).toBeInTheDocument();
      });

      // Should NOT advance to step 2
      expect(screen.queryByText('onboarding.step2.title')).not.toBeInTheDocument();
    });

    it('accepts valid WhatsApp number with country code', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
      });

      // Select WhatsApp
      fireEvent.click(screen.getByRole('button', { name: 'onboarding.step1.whatsapp' }));

      // Enter valid number
      const input = screen.getByPlaceholderText('onboarding.step1.whatsappPlaceholder');
      fireEvent.change(input, { target: { value: '+14155551234' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should advance to step 2
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
      });

      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({ whatsapp: '+14155551234' });
    });

    it('clears error when switching contact method', async () => {
      renderWithProviders(<Onboarding />);

      await waitFor(() => {
        expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
      });

      // Select WhatsApp and enter invalid number
      fireEvent.click(screen.getByRole('button', { name: 'onboarding.step1.whatsapp' }));
      const input = screen.getByPlaceholderText('onboarding.step1.whatsappPlaceholder');
      fireEvent.change(input, { target: { value: 'bad' } });
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      await waitFor(() => {
        expect(screen.getByText('onboarding.step1.errorWhatsapp')).toBeInTheDocument();
      });

      // Switch to email - error should clear
      fireEvent.click(screen.getByRole('button', { name: 'onboarding.step1.email' }));
      expect(screen.queryByText('onboarding.step1.errorWhatsapp')).not.toBeInTheDocument();
    });
  });

  describe('Step 2 validation', () => {
    it('shows error when location is missing', async () => {
      renderWithProviders(<Onboarding />);
      await goToStep2();

      // Select a skill but don't fill location
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      // Try to continue
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should show location error
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorLocation')).toBeInTheDocument();
      });
    });

    it('shows error when no skills selected', async () => {
      renderWithProviders(<Onboarding />);
      await goToStep2();

      // Fill location but don't select skills
      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });

      // Try to continue
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should show skills error
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorSkills')).toBeInTheDocument();
      });
    });

    it('shows combined error when both are missing', async () => {
      renderWithProviders(<Onboarding />);
      await goToStep2();

      // Try to continue without filling anything
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should show combined error
      await waitFor(() => {
        expect(screen.getByText('onboarding.step2.errorBoth')).toBeInTheDocument();
      });
    });

    it('proceeds to step 3 when both location and skills are filled', async () => {
      renderWithProviders(<Onboarding />);
      await goToStep2();

      // Fill location
      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });

      // Select a skill
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      // Continue
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should advance to step 3
      await waitFor(() => {
        expect(screen.getByText('onboarding.step3.title')).toBeInTheDocument();
      });

      expect(vi.mocked(api.updateProfile)).toHaveBeenCalledWith({
        location: 'New York',
        skills: ['Pet Care'],
      });
    });

    it('shows error when API call fails in step 2', async () => {
      vi.mocked(api.updateProfile)
        .mockResolvedValueOnce({} as any) // step 1 succeeds
        .mockRejectedValueOnce(new Error('Network error')); // step 2 fails

      renderWithProviders(<Onboarding />);
      await goToStep2();

      // Fill both fields
      const locationInput = screen.getByPlaceholderText('onboarding.step2.locationPlaceholder');
      fireEvent.change(locationInput, { target: { value: 'New York' } });
      fireEvent.click(screen.getByRole('button', { name: 'Pet Care' }));

      // Try to continue
      fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

      // Should show generic error
      await waitFor(() => {
        expect(screen.getByText('common.error')).toBeInTheDocument();
      });

      // Should NOT advance to step 3
      expect(screen.queryByText('onboarding.step3.title')).not.toBeInTheDocument();
    });
  });
});
