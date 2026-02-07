import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import Signup from '../pages/Signup';

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
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

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('Signup', () => {
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
});
