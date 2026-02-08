import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfileCompleteness from '../components/ProfileCompleteness';

describe('ProfileCompleteness', () => {
  it('shows correct percentage based on filled/empty profile fields', () => {
    const incompleteProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      skills: [],
      isAvailable: true,
      wallets: [],
      services: [],
    };

    render(<ProfileCompleteness profile={incompleteProfile} />);

    // Name is complete (15%), other fields incomplete
    // Total weight: 100, Completed weight: 15
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('shows 100% and success message when profile is complete', () => {
    const completeProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'A very detailed bio that is more than fifty characters long to meet the requirement',
      location: 'San Francisco',
      skills: ['react', 'typescript'],
      contactEmail: 'contact@example.com',
      isAvailable: true,
      wallets: [],
      services: [
        {
          title: 'Test Service',
          description: 'Test description',
          category: 'development',
          isActive: true,
        },
      ],
    };

    render(<ProfileCompleteness profile={completeProfile} />);

    expect(screen.getByText(/common.success/i)).toBeInTheDocument();
  });

  it('lists missing items when profile is incomplete', () => {
    const incompleteProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      skills: [],
      isAvailable: true,
      wallets: [],
      services: [],
    };

    render(<ProfileCompleteness profile={incompleteProfile} />);

    // Should show missing items (no longer includes telegram or wallets)
    expect(screen.getByText('dashboard.profile.bio')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.location')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.contactEmail')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.skills')).toBeInTheDocument();
    expect(screen.getByText('dashboard.services.title')).toBeInTheDocument();
  });

  it('does not list telegram as a required completion item', () => {
    const incompleteProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      skills: [],
      isAvailable: true,
      wallets: [],
      services: [],
    };

    render(<ProfileCompleteness profile={incompleteProfile} />);

    // Telegram should NOT be in the missing items list
    expect(screen.queryByText('dashboard.profile.telegramHandle')).not.toBeInTheDocument();
  });

  it('does not list wallets as a required completion item', () => {
    const incompleteProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      skills: [],
      isAvailable: true,
      wallets: [],
      services: [],
    };

    render(<ProfileCompleteness profile={incompleteProfile} />);

    // Wallets should NOT be in the missing items list
    expect(screen.queryByText('dashboard.wallets.title')).not.toBeInTheDocument();
  });

  it('calculates partial completion correctly', () => {
    const partialProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'A very detailed bio that is more than fifty characters long to meet the requirement',
      location: 'San Francisco',
      skills: ['react'],
      contactEmail: '',
      isAvailable: true,
      wallets: [],
      services: [],
    };

    render(<ProfileCompleteness profile={partialProfile} />);

    // name (15) + bio (20) + location (15) + skills (20) = 70 out of 100
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
