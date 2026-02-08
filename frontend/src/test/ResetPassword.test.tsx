import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import ResetPassword from '../pages/ResetPassword';

// Mock API
const mockVerifyResetToken = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    verifyResetToken: (...args: any[]) => mockVerifyResetToken(...args),
    resetPassword: (...args: any[]) => mockResetPassword(...args),
  },
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithGithub: vi.fn(),
  }),
}));

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn();
let searchParamsToken: string | null = 'valid-token';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [
      { get: (key: string) => (key === 'token' ? searchParamsToken : null) },
      vi.fn(),
    ],
  };
});

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsToken = 'valid-token';
    mockVerifyResetToken.mockResolvedValue({ valid: true });
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('shows loading state while validating token', () => {
    mockVerifyResetToken.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ResetPassword />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows invalid token message when no token in URL', async () => {
    searchParamsToken = null;
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('auth.invalidToken')).toBeInTheDocument();
    });
  });

  it('shows invalid token message for bad token', async () => {
    mockVerifyResetToken.mockResolvedValue({ valid: false });
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('auth.invalidToken')).toBeInTheDocument();
    });
  });

  it('renders password form for valid token', async () => {
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth.newPassword/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/auth.confirmPassword/i)).toBeInTheDocument();
    });
  });

  it('shows error for password mismatch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth.newPassword/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/auth.newPassword/i), 'password123');
    await user.type(screen.getByLabelText(/auth.confirmPassword/i), 'different456');
    await user.click(screen.getByRole('button', { name: /auth.resetPassword/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('auth.passwordMismatch');
    });
  });

  it('shows error for short password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth.newPassword/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/auth.newPassword/i), '12345');
    await user.type(screen.getByLabelText(/auth.confirmPassword/i), '12345');
    await user.click(screen.getByRole('button', { name: /auth.resetPassword/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('errors.passwordTooShort');
    });
  });

  it('submits successfully and shows success message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth.newPassword/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/auth.newPassword/i), 'newpassword123');
    await user.type(screen.getByLabelText(/auth.confirmPassword/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /auth.resetPassword/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('valid-token', 'newpassword123');
      expect(screen.getByText('auth.passwordReset')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('Token expired'));
    const user = userEvent.setup();
    renderWithProviders(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth.newPassword/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/auth.newPassword/i), 'newpassword123');
    await user.type(screen.getByLabelText(/auth.confirmPassword/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /auth.resetPassword/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Token expired');
    });
  });
});
