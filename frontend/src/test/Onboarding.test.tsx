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
    });
    vi.mocked(api.updateProfile).mockResolvedValue({});
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

  it('step 2 shows skill selection', async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      contactEmail: 'contact@example.com',
    });

    renderWithProviders(<Onboarding />);

    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });

    // Fill and submit step 1
    const input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
    fireEvent.change(input, { target: { value: 'contact@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /onboarding.continue/i }));

    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    // Check skill buttons exist
    expect(screen.getByText('photography')).toBeInTheDocument();
    expect(screen.getByText('videography')).toBeInTheDocument();
    expect(screen.getByText('delivery')).toBeInTheDocument();
  });

  it('can select skills in step 2', async () => {
    renderWithProviders(<Onboarding />);

    // Go through step 1
    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });
    const step1Input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
    fireEvent.change(step1Input, {
      target: { value: 'contact@example.com' },
    });
    const step1Button = screen.getByRole('button', { name: /onboarding.continue/i });
    fireEvent.click(step1Button);

    // Go through step 2
    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

    // Check that skill buttons are available
    const photographyButton = screen.getByRole('button', { name: 'photography' });
    expect(photographyButton).toBeInTheDocument();

    // Click a skill button
    fireEvent.click(photographyButton);

    // Skills should be selected (button class changes)
    expect(photographyButton.className).toContain('bg-blue-600');
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

    // Go through step 1
    await waitFor(() => {
      expect(screen.getByText('onboarding.step1.title')).toBeInTheDocument();
    });
    const step1Input = screen.getByPlaceholderText('onboarding.step1.emailPlaceholder');
    fireEvent.change(step1Input, {
      target: { value: 'contact@example.com' },
    });
    const step1Button = screen.getByRole('button', { name: /onboarding.continue/i });
    fireEvent.click(step1Button);

    // Go to step 2
    await waitFor(() => {
      expect(screen.getByText('onboarding.step2.title')).toBeInTheDocument();
    });

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
});
