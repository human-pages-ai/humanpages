import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import Signup from '../pages/Signup';

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
  },
}));

// Create shared mock functions
const mockSignup = vi.fn();
const mockNavigate = vi.fn();

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    signup: mockSignup,
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
  }),
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('Signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignup.mockResolvedValue(undefined);
  });

  it('renders name, email, password inputs', () => {
    renderWithProviders(<Signup />);

    expect(screen.getByLabelText(/common.name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/common.email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/common.password/i)).toBeInTheDocument();
  });

  it('renders the sign up button', () => {
    renderWithProviders(<Signup />);

    expect(screen.getByRole('button', { name: /auth.signUp/i })).toBeInTheDocument();
  });

  it('shows link to login page', () => {
    renderWithProviders(<Signup />);

    const loginLink = screen.getByRole('link', { name: /auth.signIn/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('renders terms acceptance checkbox', () => {
    renderWithProviders(<Signup />);

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('disables submit button when terms not accepted', () => {
    renderWithProviders(<Signup />);

    const submitButton = screen.getByRole('button', { name: /auth.signUp/i });
    expect(submitButton).toBeDisabled();
  });

  it('calls signup on form submission with terms accepted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Signup />);

    await user.type(screen.getByLabelText(/common.name/i), 'Test User');
    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /auth.signUp/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User', true);
    });
  });

  it('navigates to onboarding on success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Signup />);

    await user.type(screen.getByLabelText(/common.name/i), 'Test User');
    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /auth.signUp/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('shows error message on failure', async () => {
    mockSignup.mockRejectedValueOnce(new Error('Email already registered'));
    const user = userEvent.setup();
    renderWithProviders(<Signup />);

    await user.type(screen.getByLabelText(/common.name/i), 'Test User');
    await user.type(screen.getByLabelText(/common.email/i), 'taken@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /auth.signUp/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
    });
  });

  it('shows loading state during submission', async () => {
    mockSignup.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Signup />);

    await user.type(screen.getByLabelText(/common.name/i), 'Test User');
    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /auth.signUp/i }));

    await waitFor(() => {
      expect(screen.getByText('auth.creatingAccount')).toBeInTheDocument();
    });
  });
});
