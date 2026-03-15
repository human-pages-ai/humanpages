import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusHeader from '../components/dashboard/StatusHeader';
import { renderWithProviders, mockProfile } from './mocks';

describe('StatusHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering - profile info', () => {
    it('renders profile name', () => {
      const profile = { ...mockProfile, name: 'John Doe' };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders fallback when name is not set', () => {
      const profile = { ...mockProfile, name: '' };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('common.unnamed')).toBeInTheDocument();
    });

    it('renders avatar with first letter of name', () => {
      const profile = { ...mockProfile, name: 'John Doe' };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const avatar = container.querySelector('div[class*="rounded-full"][class*="bg-blue"]');
      expect(avatar?.textContent).toBe('J');
    });

    it('renders fallback avatar when name is empty', () => {
      const profile = { ...mockProfile, name: '' };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const avatar = container.querySelector('div[class*="rounded-full"][class*="bg-blue"]');
      expect(avatar?.textContent).toBe('?');
    });
  });

  describe('completion percentage', () => {
    it('calculates 0% when no fields are complete', () => {
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calculates 100% when all fields are complete', () => {
      const profile = {
        ...mockProfile,
        name: 'John Doe',
        bio: 'Test bio',
        location: 'San Francisco',
        contactEmail: 'john@example.com',
        skills: ['React'],
        services: [{ id: '1', title: 'Service', description: 'Desc', category: 'cat', isActive: true }],
        cvParsedAt: '2024-01-15T10:00:00Z',
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // When completeness is 100, the banner (bg-blue-600) is hidden
      const banner = container.querySelector('[class*="bg-blue-600"]');
      expect(banner).not.toBeInTheDocument();
    });

    it('uses correct weights for profile completeness', () => {
      // Name only = 15/100 = 15%
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('15%')).toBeInTheDocument();
    });

    it('includes wallets as 10% weight in completeness', () => {
      const profileWithoutWallet = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        wallets: [],
      };

      const profileWithWallet = {
        ...profileWithoutWallet,
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }],
      };

      const { rerender } = renderWithProviders(
        <StatusHeader
          profile={profileWithoutWallet}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // Without wallet: 15/100 = 15%
      expect(screen.getByText('15%')).toBeInTheDocument();

      rerender(
        <StatusHeader
          profile={profileWithWallet}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // With wallet: 25/100 = 25%
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('completion banner', () => {
    it('shows completion banner when profile is incomplete', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('onboarding.title')).toBeInTheDocument();
    });

    it('hides completion banner when profile is 100% complete', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: 'Bio',
        location: 'Location',
        contactEmail: 'john@example.com',
        skills: ['React'],
        services: [{ id: '1', title: 'Service', description: 'Desc', category: 'cat', isActive: true }],
        cvParsedAt: '2024-01-15T10:00:00Z',
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const banners = container.querySelectorAll('[class*="bg-blue-600"]');
      expect(banners.length).toBe(0);
    });

    it('shows progress bar in banner', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const progressBar = container.querySelector('[class*="bg-white"][class*="rounded-full"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('checklist visibility', () => {
    it('shows checklist when completeness is less than 50%', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('common.name')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.bio')).toBeInTheDocument();
    });

    it('hides checklist when completeness is 50% or more', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: 'Bio',
        location: 'Location',
        contactEmail: 'john@example.com',
        skills: ['React'],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // At this point with name, bio, location, contactEmail, skills = 75%
      expect(screen.queryByText('common.name')).not.toBeInTheDocument();
    });

    it('can toggle checklist visibility', async () => {
      const user = userEvent.setup();
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('common.name')).toBeInTheDocument();

      const bannerButton = screen.getByRole('button', { name: /onboarding.title/ });
      await user.click(bannerButton);

      expect(screen.queryByText('common.name')).not.toBeInTheDocument();

      await user.click(bannerButton);

      expect(screen.getByText('common.name')).toBeInTheDocument();
    });
  });

  describe('checklist items', () => {
    it('shows all completion items in checklist', () => {
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('common.name')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.bio')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.location')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.contactEmail')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.skills')).toBeInTheDocument();
      expect(screen.getByText('dashboard.services.title')).toBeInTheDocument();
      expect(screen.getByText('dashboard.profile.paymentInfo')).toBeInTheDocument();
    });

    it('shows weight for each incomplete item', () => {
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // Should show weights: +15%, +15%, +15%, +15%, +15%, +15%, +10%
      const weights = screen.getAllByText(/\+\d+%/);
      expect(weights.length).toBeGreaterThan(0);
    });

    it('marks items as complete with checkmark', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const checkmarks = container.querySelectorAll('svg[class*="text-blue-200"]');
      expect(checkmarks.length).toBeGreaterThan(0);
    });

    it('shows empty circles for incomplete items', () => {
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const circles = container.querySelectorAll('circle[r="9"]');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('shows "Add" button for incomplete items', () => {
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const addButtons = screen.getAllByText('common.add');
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('does not show "Add" button for complete items', () => {
      const profile = {
        ...mockProfile,
        name: 'John',
        bio: 'Bio text',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      // Complete items should have strikethrough and different styling
      const strikethrough = container.querySelector('span[class*="line-through"]');
      expect(strikethrough).toBeInTheDocument();
    });
  });

  describe('availability toggle', () => {
    it('renders availability button', () => {
      const profile = { ...mockProfile, isAvailable: true };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByTestId('status-availability')).toBeInTheDocument();
    });

    it('shows "active" text when available', () => {
      const profile = { ...mockProfile, isAvailable: true };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('dashboard.workStatus.active')).toBeInTheDocument();
    });

    it('shows "paused" text when not available', () => {
      const profile = { ...mockProfile, isAvailable: false };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('dashboard.workStatus.paused')).toBeInTheDocument();
    });

    it('calls onToggleAvailability when button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleAvailability = vi.fn();
      const profile = { ...mockProfile, isAvailable: true };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={onToggleAvailability}
        />
      );

      const button = screen.getByTestId('status-availability');
      await user.click(button);

      expect(onToggleAvailability).toHaveBeenCalledTimes(1);
    });

    it('disables button when saving is true', () => {
      const profile = { ...mockProfile, isAvailable: true };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={true}
          onToggleAvailability={vi.fn()}
        />
      );

      const button = screen.getByTestId('status-availability');
      expect(button).toBeDisabled();
    });

    it('shows green styling when available', () => {
      const profile = { ...mockProfile, isAvailable: true };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const button = screen.getByTestId('status-availability');
      expect(button).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('shows gray styling when paused', () => {
      const profile = { ...mockProfile, isAvailable: false };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const button = screen.getByTestId('status-availability');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-600');
    });
  });

  describe('review stats display', () => {
    it('shows completed jobs and average rating when available', () => {
      const profile = { ...mockProfile };
      const reviewStats = {
        completedJobs: 15,
        averageRating: 4.8,
        totalReviews: 20,
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={reviewStats}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText(/15/)).toBeInTheDocument();
      // The rating is rendered as part of a span: "15 dashboard.jobs.status.completed · 4.8★"
      // Use regex match since getByText('4.8') expects exact full text match
      expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    });

    it('hides stats when no completed jobs', () => {
      const profile = { ...mockProfile };
      const reviewStats = {
        completedJobs: 0,
        averageRating: 0,
        totalReviews: 0,
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={reviewStats}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
    });

    it('hides stats when reviewStats is null', () => {
      const profile = { ...mockProfile };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
    });
  });

  describe('wallet display', () => {
    it('shows wallet count when wallets exist', () => {
      const profile = {
        ...mockProfile,
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }, { id: '2', network: 'solana', address: 'ABC123' }],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('2 wallets')).toBeInTheDocument();
    });

    it('shows singular "wallet" when only one wallet', () => {
      const profile = {
        ...mockProfile,
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('1 wallet')).toBeInTheDocument();
    });

    it('hides wallet info when no wallets', () => {
      const profile = {
        ...mockProfile,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.queryByText(/wallets?/)).not.toBeInTheDocument();
    });

    it('shows wallet icon with checkmark', () => {
      const profile = {
        ...mockProfile,
        wallets: [{ id: '1', network: 'ethereum', address: '0x1234' }],
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const walletIcon = container.querySelector('svg[class*="text-green-500"]');
      expect(walletIcon).toBeInTheDocument();
    });
  });

  describe('pending jobs badge', () => {
    it('shows pending jobs badge when jobs exist', () => {
      const jobs = [
        { id: '1', status: 'PENDING' as const, agentId: 'agent1', title: 'Job 1', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', status: 'PENDING' as const, agentId: 'agent1', title: 'Job 2', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-02T00:00:00Z' },
      ];
      const profile = { ...mockProfile };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={jobs}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('2 pending')).toBeInTheDocument();
    });

    it('hides pending badge when no pending jobs', () => {
      const jobs = [
        { id: '1', status: 'COMPLETED' as const, agentId: 'agent1', title: 'Job 1', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', status: 'CANCELLED' as const, agentId: 'agent1', title: 'Job 2', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-02T00:00:00Z' },
      ];
      const profile = { ...mockProfile };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={jobs}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    });

    it('counts only PENDING status jobs', () => {
      const jobs = [
        { id: '1', status: 'PENDING' as const, agentId: 'agent1', title: 'Job 1', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', status: 'COMPLETED' as const, agentId: 'agent1', title: 'Job 2', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-02T00:00:00Z' },
        { id: '3', status: 'PENDING' as const, agentId: 'agent1', title: 'Job 3', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-03T00:00:00Z' },
      ];
      const profile = { ...mockProfile };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={jobs}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('2 pending')).toBeInTheDocument();
    });

    it('shows badge with yellow styling', () => {
      const jobs = [{ id: '1', status: 'PENDING' as const, agentId: 'agent1', title: 'Job 1', description: 'Desc', priceUsdc: '100', createdAt: '2024-01-01T00:00:00Z' }];
      const profile = { ...mockProfile };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={jobs}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const badge = screen.getByText('1 pending');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  describe('referral program', () => {
    it('shows referral credits when available', () => {
      const profile = {
        ...mockProfile,
        referralProgram: { status: 'APPROVED' as const, creditsPerReferral: 10, totalSignups: 5, qualifiedSignups: 5, totalCredits: 500, creditsRedeemed: 100, availableCredits: 400, milestones: [], referrals: [], creditLedger: [] },
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('hides referral credits when program is not set', () => {
      const profile = {
        ...mockProfile,
        referralProgram: undefined,
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      expect(screen.queryByText(/\d+/)).toBeInTheDocument(); // Should still have 0%
    });

    it('hides referral badge when totalCredits is 0', () => {
      const profile = {
        ...mockProfile,
        referralProgram: { status: 'APPROVED' as const, creditsPerReferral: 10, totalSignups: 0, qualifiedSignups: 0, totalCredits: 0, creditsRedeemed: 0, availableCredits: 0, milestones: [], referrals: [], creditLedger: [] },
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const badges = container.querySelectorAll('[class*="bg-emerald"]');
      expect(badges.length).toBe(0);
    });

    it('shows referral icon', () => {
      const profile = {
        ...mockProfile,
        referralProgram: { status: 'APPROVED' as const, creditsPerReferral: 10, totalSignups: 5, qualifiedSignups: 5, totalCredits: 500, creditsRedeemed: 100, availableCredits: 400, milestones: [], referrals: [], creditLedger: [] },
      };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const icon = container.querySelector('svg[class*="text-emerald"]') ||
                   container.querySelector('[class*="bg-emerald"] svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('click handlers for checklist items', () => {
    it('calls onAddService when services item is clicked', async () => {
      const user = userEvent.setup();
      const onAddService = vi.fn();
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
          onAddService={onAddService}
        />
      );

      const serviceItem = screen.getByText('dashboard.services.title');
      await user.click(serviceItem.closest('li')!.querySelector('button')!);

      expect(onAddService).toHaveBeenCalled();
    });

    it('calls onScrollToWallets when payment info item is clicked', async () => {
      const user = userEvent.setup();
      const onScrollToWallets = vi.fn();
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
          onScrollToWallets={onScrollToWallets}
        />
      );

      const paymentItem = screen.getByText('dashboard.profile.paymentInfo');
      await user.click(paymentItem.closest('li')!.querySelector('button')!);

      expect(onScrollToWallets).toHaveBeenCalled();
    });

    it('calls onCompleteProfile for other items', async () => {
      const user = userEvent.setup();
      const onCompleteProfile = vi.fn();
      const profile = {
        ...mockProfile,
        name: '',
        bio: '',
        location: '',
        contactEmail: '',
        skills: [],
        services: [],
        cvParsedAt: undefined,
        wallets: [],
      };
      renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
          onCompleteProfile={onCompleteProfile}
        />
      );

      const nameItem = screen.getByText('common.name');
      await user.click(nameItem.closest('li')!.querySelector('button')!);

      expect(onCompleteProfile).toHaveBeenCalledWith('profile-name');
    });
  });

  describe('responsive layout', () => {
    it('renders flex layout with responsive classes', () => {
      const profile = { ...mockProfile };
      const { container } = renderWithProviders(
        <StatusHeader
          profile={profile}
          jobs={[]}
          reviewStats={null}
          saving={false}
          onToggleAvailability={vi.fn()}
        />
      );

      const flexContainer = container.querySelector('[class*="sm:flex-row"]');
      expect(flexContainer).toBeInTheDocument();
    });
  });
});
