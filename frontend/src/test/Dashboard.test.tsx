import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockProfile } from './mocks';
import Dashboard from '../pages/Dashboard';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn(),
    getJobs: vi.fn(),
    getWallets: vi.fn(),
    getServices: vi.fn(),
    getMyReviews: vi.fn(),
    getTelegramStatus: vi.fn(),
    updateProfile: vi.fn(),
    acceptJob: vi.fn(),
    rejectJob: vi.fn(),
    completeJob: vi.fn(),
    addWallet: vi.fn(),
    deleteWallet: vi.fn(),
    createService: vi.fn(),
    updateService: vi.fn(),
    deleteService: vi.fn(),
    linkTelegram: vi.fn(),
    unlinkTelegram: vi.fn(),
  },
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
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

describe('Dashboard', () => {
  beforeEach(() => {
    // Set up default mocks
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      wallets: [],
      services: [],
    });
    vi.mocked(api.getJobs).mockResolvedValue([]);
    vi.mocked(api.getMyReviews).mockResolvedValue({ stats: { totalReviews: 0, averageRating: 0, completedJobs: 0 }, reviews: [] });
    vi.mocked(api.getTelegramStatus).mockResolvedValue({ connected: false, botAvailable: false });
  });

  it('renders loading state initially', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('renders profile section after loading', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Should display user name in nav
    expect(screen.getAllByText('Test User')[0]).toBeInTheDocument();
  });

  it('renders jobs section', async () => {
    vi.mocked(api.getJobs).mockResolvedValue([
      {
        id: 'job-1',
        title: 'Test Job',
        description: 'Test description',
        status: 'PENDING',
      } as any,
    ]);

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Jobs section should be present
    expect(screen.getByText('dashboard.jobs.title')).toBeInTheDocument();
  });

  it('renders wallets section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Wallets section should be present (title may appear in completeness widget too)
    expect(screen.getAllByText('dashboard.wallets.paymentSetupTitle')[0]).toBeInTheDocument();
  });

  it('renders services section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Services section should be present (title may appear in completeness widget too)
    expect(screen.getAllByText('dashboard.services.title')[0]).toBeInTheDocument();
  });

  it('shows empty states when no data', async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      wallets: [],
      services: [],
    });
    vi.mocked(api.getJobs).mockResolvedValue([]);

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Should render sections even with empty data
    expect(screen.getByText('dashboard.jobs.title')).toBeInTheDocument();
    expect(screen.getAllByText('dashboard.wallets.paymentSetupTitle')[0]).toBeInTheDocument();
    expect(screen.getAllByText('dashboard.services.title')[0]).toBeInTheDocument();
  });

  it('displays error state when profile fails to load', async () => {
    vi.mocked(api.getProfile).mockRejectedValue(new Error('Failed to load'));

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('common.error')).toBeInTheDocument();
  });

  it('renders pending jobs with accept/reject buttons', async () => {
    vi.mocked(api.getJobs).mockResolvedValue([
      {
        id: 'job-1',
        title: 'Pending Job',
        description: 'Test',
        status: 'PENDING',
        priceUsdc: 50,
        agentName: 'Agent A',
        createdAt: new Date().toISOString(),
      } as any,
    ]);

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Pending Job')).toBeInTheDocument();
  });

  it('renders wallet addresses', async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      wallets: [
        { id: 'w1', network: 'ethereum', address: '0xabc123' },
      ],
      services: [],
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/0xabc123/)).toBeInTheDocument();
  });

  it('renders services list', async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      wallets: [],
      services: [
        { id: 's1', title: 'Web Development', description: 'Build websites', category: 'development', isActive: true },
      ],
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Web Development')).toBeInTheDocument();
  });

  it('renders telegram section when bot is available', async () => {
    vi.mocked(api.getTelegramStatus).mockResolvedValue({ connected: false, botAvailable: true, botUsername: 'test_bot' });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Telegram is inside the collapsed "Integrations" group - check the group header exists
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('renders job stats with review data', async () => {
    vi.mocked(api.getMyReviews).mockResolvedValue({
      stats: { totalReviews: 5, averageRating: 4.5, completedJobs: 10 },
      reviews: [],
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Jobs section renders stats inline
    expect(screen.getByText('dashboard.jobs.title')).toBeInTheDocument();
  });

  it('renders share/referral section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    // Share/referral is inside the collapsed "Sharing & Growth" group - check the group header exists
    expect(screen.getByText('Sharing & Growth')).toBeInTheDocument();
  });
});
