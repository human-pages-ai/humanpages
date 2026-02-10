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

  it('renders nothing when profile is complete', () => {
    const completeProfile = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'A very detailed bio that is more than fifty characters long to meet the requirement',
      location: 'San Francisco',
      skills: ['react', 'typescript'],
      contactEmail: 'contact@example.com',
      isAvailable: true,
      wallets: [{ id: 'w1', network: 'ethereum', address: '0xabc123' }],
      services: [
        {
          title: 'Test Service',
          description: 'Test description',
          category: 'development',
          isActive: true,
        },
      ],
    };

    const { container } = render(<ProfileCompleteness profile={completeProfile} />);

    // Component returns null when 100% complete
    expect(container.innerHTML).toBe('');
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

  it('lists paymentInfo as a completion item when no wallet connected', () => {
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

    // Payment Info should be in the missing items list when no wallet
    expect(screen.getByText('dashboard.profile.paymentInfo')).toBeInTheDocument();
  });

  it('does not list paymentInfo when wallet is connected', () => {
    const profileWithWallet = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      skills: [],
      isAvailable: true,
      wallets: [{ id: 'w1', network: 'ethereum', address: '0xabc123' }],
      services: [],
    };

    render(<ProfileCompleteness profile={profileWithWallet} />);

    // Payment Info should NOT be listed when wallet is connected
    expect(screen.queryByText('dashboard.profile.paymentInfo')).not.toBeInTheDocument();
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

    // name (15) + bio (15) + location (15) + skills (15) = 60 out of 100
    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});
