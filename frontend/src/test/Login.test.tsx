import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import Login from '../pages/Login';

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

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Login', () => {
  it('renders email and password inputs', () => {
    renderWithProviders(<Login />);

    expect(screen.getByLabelText(/common.email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/common.password/i)).toBeInTheDocument();
  });

  it('renders the sign in button', () => {
    renderWithProviders(<Login />);

    expect(screen.getByRole('button', { name: /auth.signIn/i })).toBeInTheDocument();
  });

  it('shows link to signup page', () => {
    renderWithProviders(<Login />);

    const signupLink = screen.getByRole('link', { name: /auth.signUp/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute('href', '/signup');
  });
});
