import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from '../App';

// Track auth state that can be changed per-test
let mockUser: { id: string; email: string; name: string } | null = null;
let mockLoading = false;

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
  }),
}));

// Mock posthog
vi.mock('../lib/posthog', () => ({
  posthog: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
  initPostHog: vi.fn(),
}));

// Mock analytics
vi.mock('../lib/analytics', () => ({
  analytics: { track: vi.fn() },
}));

// Mock i18n module
vi.mock('../i18n', () => ({
  supportedLanguages: [
    { code: 'en', name: 'English', flag: '' },
    { code: 'es', name: 'Español', flag: '' },
  ],
  default: {},
}));

// Track admin check behavior
let mockCheckAdminResult: 'admin' | 'not-admin' | 'error' = 'not-admin';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn().mockRejectedValue(new Error('not authed')),
    getJobs: vi.fn().mockResolvedValue([]),
    getTelegramStatus: vi.fn().mockResolvedValue({ connected: false, botAvailable: false }),
    getMyReviews: vi.fn().mockResolvedValue({ stats: null }),
    checkAdmin: vi.fn().mockImplementation(() => {
      if (mockCheckAdminResult === 'admin') {
        return Promise.resolve({ isAdmin: true });
      }
      return Promise.reject(new Error('Admin access required'));
    }),
    getAdminStats: vi.fn().mockResolvedValue({
      users: { total: 10, verified: 8, last7d: 3, last30d: 7 },
      agents: { total: 5, byStatus: { ACTIVE: 3, PENDING: 2 } },
      jobs: { total: 20, byStatus: { COMPLETED: 10, PENDING: 5, PAID: 5 }, last7d: 4, last30d: 12, paymentVolume: 1500 },
      reports: { total: 2, pending: 1 },
      affiliates: { total: 3, approved: 2 },
    }),
  },
}));

function renderApp(initialRoute: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Admin Route Guards', () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
    mockCheckAdminResult = 'not-admin';
  });

  describe('/admin (AdminRoute)', () => {
    it('redirects unauthenticated users to /dashboard (then /login)', async () => {
      renderApp('/admin');
      await waitFor(() => {
        // Unauthenticated: AdminRoute redirects to /dashboard, ProtectedRoute redirects to /login
        expect(screen.getByRole('button', { name: /auth.signIn/i })).toBeInTheDocument();
      });
    });

    it('redirects non-admin authenticated users to /dashboard', async () => {
      mockUser = { id: '1', email: 'user@test.com', name: 'Regular User' };
      mockCheckAdminResult = 'not-admin';

      renderApp('/admin');
      await waitFor(() => {
        // Should redirect to /dashboard — shows loading/dashboard content
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });

    it('shows admin dashboard for admin users', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin');
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });

    it('shows loading state while checking admin status', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      // checkAdmin never resolves — stays in loading
      const { api } = await import('../lib/api');
      (api.checkAdmin as any).mockImplementationOnce(() => new Promise(() => {}));

      renderApp('/admin');
      expect(screen.getByText('common.loading')).toBeInTheDocument();
    });
  });

  describe('/admin sub-routes', () => {
    it('renders admin users page for admin users', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin/users');
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      });
    });

    it('renders admin agents page for admin users', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin/agents');
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search agents/i)).toBeInTheDocument();
      });
    });

    it('renders admin jobs page for admin users', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin/jobs');
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search jobs/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admin navigation', () => {
    it('renders all nav links', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin');
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('People')).toBeInTheDocument();
        expect(screen.getByText('Agents')).toBeInTheDocument();
        expect(screen.getByText('Jobs')).toBeInTheDocument();
        expect(screen.getByText('Activity')).toBeInTheDocument();
      });
    });

    it('renders back to app link', async () => {
      mockUser = { id: '1', email: 'admin@test.com', name: 'Admin' };
      mockCheckAdminResult = 'admin';

      renderApp('/admin');
      await waitFor(() => {
        expect(screen.getByText('Back to app')).toBeInTheDocument();
      });
    });
  });
});
