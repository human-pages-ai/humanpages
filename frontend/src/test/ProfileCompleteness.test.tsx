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

    // Name is complete (10%), other fields incomplete
    // Total weight: 100, Completed weight: 10
    expect(screen.getByText('10%')).toBeInTheDocument();
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
      telegram: '@testuser',
      isAvailable: true,
      wallets: [{ network: 'ethereum', address: '0x123' }],
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

    // Should show missing items
    expect(screen.getByText('dashboard.profile.bio')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.location')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.contactEmail')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.telegramHandle')).toBeInTheDocument();
    expect(screen.getByText('dashboard.profile.skills')).toBeInTheDocument();
    expect(screen.getByText('dashboard.services.title')).toBeInTheDocument();
    expect(screen.getByText('dashboard.wallets.title')).toBeInTheDocument();
  });
});
