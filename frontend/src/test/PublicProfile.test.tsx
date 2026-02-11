import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import PublicProfile from '../pages/PublicProfile';
import React from 'react';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getHumanById: vi.fn(),
  },
}));

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
  },
}));

// Mock LanguageSwitcher component
vi.mock('../components/LanguageSwitcher', () => ({
  default: () => null,
}));

const mockPublicProfile = {
  id: 'test-id',
  name: 'Test User',
  bio: 'Test bio description',
  location: 'San Francisco',
  skills: ['react', 'typescript', 'node'],
  contactEmail: 'test@example.com',
  telegram: '@testuser',
  isAvailable: true,
  linkedinUrl: 'https://linkedin.com/in/testuser',
  wallets: [
    {
      network: 'ethereum',
      address: '0x123456789',
      label: 'Main wallet',
    },
  ],
  services: [
    {
      title: 'Web Development',
      description: 'Full-stack web development services',
      category: 'Development',
      priceMin: 50,
      priceUnit: 'HOURLY',
    },
  ],
};

function renderWithRouter(ui: React.ReactElement, { route = '/profile/test-id' } = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/profile/:id" element={ui} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('PublicProfile', () => {
  beforeEach(() => {
    vi.mocked(api.getHumanById).mockResolvedValue(mockPublicProfile as any);
  });

  it('renders loading state', () => {
    renderWithRouter(<PublicProfile />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows profile data (name, bio, skills)', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Check name
    expect(screen.getByText('Test User')).toBeInTheDocument();

    // Check bio
    expect(screen.getByText('Test bio description')).toBeInTheDocument();

    // Check location
    expect(screen.getByText('San Francisco')).toBeInTheDocument();

    // Check skills
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
  });

  it('shows wallets section', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Check wallets title
    expect(screen.getByText('dashboard.wallets.paymentSetupTitle')).toBeInTheDocument();

    // Check wallet data
    expect(screen.getByText('ethereum')).toBeInTheDocument();
    expect(screen.getByText('0x123456789')).toBeInTheDocument();
    expect(screen.getByText('Main wallet')).toBeInTheDocument();
  });

  it('shows services section', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Check services title
    expect(screen.getByText('dashboard.services.title')).toBeInTheDocument();

    // Check service data
    expect(screen.getByText('Web Development')).toBeInTheDocument();
    expect(screen.getByText('Full-stack web development services')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('$50/hr')).toBeInTheDocument();
  });

  it('shows contact information', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Check contact section exists
    expect(screen.getByText('publicProfile.contactInfo')).toBeInTheDocument();

    // Check email
    expect(screen.getByText('test@example.com')).toBeInTheDocument();

    // Check telegram
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('shows availability status', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('publicProfile.available')).toBeInTheDocument();
  });

  it('shows unavailable status when not available', async () => {
    vi.mocked(api.getHumanById).mockResolvedValue({
      ...mockPublicProfile,
      isAvailable: false,
    } as any);

    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('publicProfile.unavailable')).toBeInTheDocument();
  });

  it('shows social profiles when available', async () => {
    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('dashboard.profile.socialProfiles')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.linkedin')).toBeInTheDocument();
  });

  it('handles 404 (user not found)', async () => {
    vi.mocked(api.getHumanById).mockRejectedValue(new Error('Not found'));

    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('errors.notFound')).toBeInTheDocument();
    expect(screen.getByText('nav.home')).toBeInTheDocument();
  });

  it('shows empty state for skills when none exist', async () => {
    vi.mocked(api.getHumanById).mockResolvedValue({
      ...mockPublicProfile,
      skills: [],
    } as any);

    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('publicProfile.noSkills')).toBeInTheDocument();
  });

  it('shows empty state for services when none exist', async () => {
    vi.mocked(api.getHumanById).mockResolvedValue({
      ...mockPublicProfile,
      services: [],
    } as any);

    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('publicProfile.noServices')).toBeInTheDocument();
  });

  it('does not show wallets section when no wallets', async () => {
    vi.mocked(api.getHumanById).mockResolvedValue({
      ...mockPublicProfile,
      wallets: [],
    } as any);

    renderWithRouter(<PublicProfile />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Wallets section should not be rendered when empty
    const walletsTitles = screen.queryAllByText('dashboard.wallets.title');
    expect(walletsTitles.length).toBe(0);
  });
});
