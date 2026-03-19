import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import Login from '../pages/Login';

// Create shared mock functions that we can inspect
const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockNavigate = vi.fn();

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: mockLoginWithGoogle,
    loginWithWhatsApp: vi.fn(),
    loginWithLinkedIn: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: { track: vi.fn() },
}));

// Mock react-turnstile to auto-verify
vi.mock('react-turnstile', async () => {
  const { useEffect } = await import('react');
  return {
    Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
      useEffect(() => { onVerify('test-captcha-token'); }, []);
      return null;
    },
  };
});

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Click the "or sign in with email" toggle to reveal the email/password form */
async function expandEmailForm(user: ReturnType<typeof userEvent.setup>) {
  const toggle = screen.getByRole('button', { name: /or sign in with email/i });
  await user.click(toggle);
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockLoginWithGoogle.mockResolvedValue(undefined);
  });

  it('renders email and password inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    expect(screen.getByLabelText(/common.email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/common.password/i)).toBeInTheDocument();
  });

  it('renders the sign in button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    expect(screen.getByRole('button', { name: /auth.signIn/i })).toBeInTheDocument();
  });

  it('shows link to signup page', () => {
    renderWithProviders(<Login />);

    const signupLink = screen.getByRole('link', { name: /auth.signUp/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute('href', '/signup');
  });

  it('renders forgot password link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    const forgotLink = screen.getByRole('link', { name: /auth.forgotPassword/i });
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  it('should call login on form submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    const emailInput = screen.getByLabelText(/common.email/i);
    const passwordInput = screen.getByLabelText(/common.password/i);
    const submitButton = screen.getByRole('button', { name: /auth.signIn/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', 'test-captcha-token');
    });
  });

  it('should navigate to dashboard on successful login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /auth.signIn/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    await user.type(screen.getByLabelText(/common.email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /auth.signIn/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('should call loginWithGoogle when Google button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    // Find the Google button by its text content
    const googleButton = screen.getByRole('button', { name: /google/i });
    await user.click(googleButton);

    expect(mockLoginWithGoogle).toHaveBeenCalledOnce();
  });

  it('should show loading state during login submission', async () => {
    // Make login hang so we can observe loading state
    mockLogin.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await expandEmailForm(user);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/common.password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /auth.signIn/i }));

    await waitFor(() => {
      expect(screen.getByText(/auth.signingIn/i)).toBeInTheDocument();
    });
  });
});
