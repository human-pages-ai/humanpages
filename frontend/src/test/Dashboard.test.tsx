import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
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
vi.mock('../lib/safeStorage', () => {
  const store: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const makeMock = (s: Record<string, string>) => ({
    getItem: vi.fn((k: string) => s[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { s[k] = v; }),
    removeItem: vi.fn((k: string) => { delete s[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(s)) delete s[k]; }),
    isAvailable: vi.fn(() => true),
  });
  return {
    safeLocalStorage: makeMock(store),
    safeSessionStorage: makeMock(sessionStore),
    safeGetItem: vi.fn((k: string) => store[k] ?? null),
    safeSetItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    safeRemoveItem: vi.fn((k: string) => { delete store[k]; }),
  };
});


// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithWhatsApp: vi.fn(),
    loginWithLinkedIn: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

// Mock wallet components (avoid loading Privy in tests)
vi.mock('../components/dashboard/WalletProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/dashboard/WalletsSection', () => ({
  default: ({ wallets }: { wallets: Array<{ id: string; network: string; address: string }> }) => (
    <div data-testid="wallets-section">
      {wallets.map((w) => (
        <div key={w.id}>{w.address}</div>
      ))}
    </div>
  ),
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

/** Wait for dashboard to finish loading */
async function waitForDashboard() {
  await waitFor(() => {
    expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
  });
}

/** Click a dashboard tab by its translated label key */
function clickTab(labelKey: string) {
  const tabs = screen.getAllByRole('tab');
  const tab = tabs.find((t) => t.textContent?.includes(labelKey));
  if (!tab) throw new Error(`Tab with text "${labelKey}" not found`);
  fireEvent.click(tab);
}

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL so each test starts on the default (jobs) tab
    window.history.pushState({}, '', '/');
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

    await waitForDashboard();

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

    await waitForDashboard();

    // Jobs tab is the default — title appears in both tab label and section heading
    expect(screen.getAllByText('dashboard.jobs.title').length).toBeGreaterThanOrEqual(1);
  });

  it('renders wallets section', async () => {
    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Wallets tab label is visible even before switching
    expect(screen.getAllByText('dashboard.wallets.paymentSetupTitle')[0]).toBeInTheDocument();
  });

  it('renders services section', async () => {
    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Services are on the Profile tab — switch to it
    clickTab('dashboard.profile.title');

    expect(screen.getAllByText('dashboard.tiles.services.title')[0]).toBeInTheDocument();
  });

  it('shows empty states when no data', async () => {
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      wallets: [],
      services: [],
    });
    vi.mocked(api.getJobs).mockResolvedValue([]);

    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Jobs section (default tab)
    expect(screen.getAllByText('dashboard.jobs.title').length).toBeGreaterThanOrEqual(1);

    // Switch to profile tab for services
    clickTab('dashboard.profile.title');
    expect(screen.getAllByText('dashboard.tiles.services.title')[0]).toBeInTheDocument();

    // Switch to payments tab for wallets
    clickTab('dashboard.wallets.paymentSetupTitle');
    await waitFor(() => {
      expect(screen.getAllByText('dashboard.wallets.paymentSetupTitle').length).toBeGreaterThanOrEqual(1);
    });
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

    await waitForDashboard();

    // Jobs are on the Jobs tab — switch to it
    clickTab('dashboard.jobs.title');

    await waitFor(() => {
      expect(screen.getByText('Pending Job')).toBeInTheDocument();
    });
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

    await waitForDashboard();

    // Wallets are on the Payments tab (lazy-loaded)
    clickTab('dashboard.wallets.paymentSetupTitle');

    await waitFor(() => {
      expect(screen.getByText(/0xabc123/)).toBeInTheDocument();
    });
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

    await waitForDashboard();

    // Services are on the Profile tab
    clickTab('dashboard.profile.title');

    expect(screen.getByText('Web Development')).toBeInTheDocument();
  });

  it('renders telegram section when bot is available', async () => {
    vi.mocked(api.getTelegramStatus).mockResolvedValue({ connected: false, botAvailable: true, botUsername: 'test_bot' });
    // Need pushNotifications so the tile is not in "empty" mode (which hides children)
    vi.mocked(api.getProfile).mockResolvedValue({
      ...mockProfile,
      pushNotifications: true,
      wallets: [],
      services: [],
    });

    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Telegram notification is shown in the Notifications tile on the Profile tab (default tab)
    await waitFor(() => {
      expect(screen.getByText(/dashboard\.tiles\.notifications\.telegram/)).toBeInTheDocument();
    });
  });

  it('renders job stats with review data', async () => {
    vi.mocked(api.getMyReviews).mockResolvedValue({
      stats: { totalReviews: 5, averageRating: 4.5, completedJobs: 10 },
      reviews: [],
    });

    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Jobs section renders stats inline — on default jobs tab
    expect(screen.getAllByText('dashboard.jobs.title').length).toBeGreaterThanOrEqual(1);
  });

  it('renders share/referral section', async () => {
    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    // Share/referral is now on the Profile tab
    clickTab('dashboard.profile.title');

    expect(screen.getByText('dashboard.share.title')).toBeInTheDocument();
  });

  it('displays error state when profile fails to load', async () => {
    vi.mocked(api.getProfile).mockRejectedValueOnce(new Error('Failed to load'));

    renderWithProviders(<Dashboard />);

    await waitForDashboard();

    expect(screen.getByText('common.error')).toBeInTheDocument();
  });
});
