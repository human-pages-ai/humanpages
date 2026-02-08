import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import ForgotPassword from '../pages/ForgotPassword';

// Mock API
const mockForgotPassword = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    forgotPassword: (...args: any[]) => mockForgotPassword(...args),
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
  }),
}));

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForgotPassword.mockResolvedValue(undefined);
  });

  it('renders email input and submit button', () => {
    renderWithProviders(<ForgotPassword />);
    expect(screen.getByLabelText(/common.email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auth.sendResetLink/i })).toBeInTheDocument();
  });

  it('renders back to login link', () => {
    renderWithProviders(<ForgotPassword />);
    const link = screen.getByRole('link', { name: /common.back auth.signIn/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('submits email and shows success message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /auth.sendResetLink/i }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(screen.getByText('auth.resetSent')).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /auth.sendResetLink/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('shows loading state during submission', async () => {
    mockForgotPassword.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /auth.sendResetLink/i }));

    await waitFor(() => {
      expect(screen.getByText('auth.sending')).toBeInTheDocument();
    });
  });

  it('disables button while loading', async () => {
    mockForgotPassword.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    await user.type(screen.getByLabelText(/common.email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /auth.sendResetLink/i }));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
      expect(submitButton).toBeDisabled();
    });
  });

  it('displays email in success message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);

    await user.type(screen.getByLabelText(/common.email/i), 'user@test.com');
    await user.click(screen.getByRole('button', { name: /auth.sendResetLink/i }));

    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeInTheDocument();
    });
  });
});
