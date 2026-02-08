import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import LandingPage from '../pages/LandingPage';

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: { track: vi.fn() },
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

describe('LandingPage', () => {
  it('renders hero title', () => {
    const { container } = renderWithProviders(<LandingPage />);
    // Title is split across <br/> so check the h1 contains the title key
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toContain('landing.hero.title');
  });

  it('renders signup CTA link', () => {
    renderWithProviders(<LandingPage />);
    const ctaLinks = screen.getAllByRole('link').filter(
      (link) => link.getAttribute('href') === '/signup'
    );
    expect(ctaLinks.length).toBeGreaterThan(0);
  });

  it('renders tasks section', () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByText('landing.tasks.title')).toBeInTheDocument();
  });

  it('renders benefits section', () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByText('landing.benefits.findWork')).toBeInTheDocument();
  });

  it('renders FAQ section', () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByText('landing.faq.whatIs')).toBeInTheDocument();
  });
});
