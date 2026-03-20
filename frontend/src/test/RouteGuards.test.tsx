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
    loginWithWhatsApp: vi.fn(),
    loginWithLinkedIn: vi.fn(),
    updateUser: vi.fn(),
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

// Mock i18n module (supportedLanguages export used by LangWrapper)
vi.mock('../i18n', () => ({
  supportedLanguages: [
    { code: 'en', name: 'English', flag: '' },
    { code: 'es', name: 'Español', flag: '' },
    { code: 'zh', name: '中文', flag: '' },
    { code: 'tl', name: 'Filipino', flag: '' },
    { code: 'hi', name: 'हिन्दी', flag: '' },
    { code: 'vi', name: 'Tiếng Việt', flag: '' },
    { code: 'tr', name: 'Türkçe', flag: '' },
    { code: 'th', name: 'ไทย', flag: '' },
  ],
  default: {},
}));

// Mock API for components that call it directly
vi.mock('../lib/api', () => ({
  api: {
    getProfile: vi.fn().mockRejectedValue(new Error('not authed')),
    getJobs: vi.fn().mockResolvedValue([]),
    getTelegramStatus: vi.fn().mockResolvedValue({ connected: false, botAvailable: false }),
    getMyReviews: vi.fn().mockResolvedValue({ stats: null }),
    getListings: vi.fn().mockResolvedValue({ listings: [], total: 0 }),
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


function renderApp(initialRoute: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Route Guards', () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
  });

  // ===== LANDING PAGE (/) =====
  describe('/ (landing page)', () => {
    it('shows landing page for unauthenticated users', async () => {
      renderApp('/');
      await waitFor(() => {
        // The landing page should render (not redirect to /dashboard)
        // It may show translated keys or loading state depending on i18n
        const heading = screen.queryByRole('heading', { level: 1 });
        const loading = screen.queryByRole('status');
        expect(heading || loading).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('redirects authenticated users to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });
  });

  // ===== LANGUAGE-PREFIXED LANDING PAGES =====
  describe('/:lang (language-prefixed landing page)', () => {
    it('shows landing page for unauthenticated user at /tl', async () => {
      renderApp('/tl');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('redirects authenticated user at /tl to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/tl');
      await waitFor(() => {
        // Should redirect to dashboard (which shows loading/dashboard content)
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });

    it('shows landing page for unauthenticated user at /es', async () => {
      renderApp('/es');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('redirects authenticated user at /es to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/es');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });

    it('redirects authenticated user at /zh to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/zh');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });

    it('redirects /en to / (no language prefix for English)', async () => {
      renderApp('/en');
      await waitFor(() => {
        // /en redirects to /, which shows landing page for unauthed
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('shows 404 for invalid language code', async () => {
      renderApp('/xx');
      await waitFor(() => {
        expect(screen.getByText('notFound.title')).toBeInTheDocument();
      });
    });
  });

  // ===== LOGIN/SIGNUP (PublicRoute) =====
  describe('/login (PublicRoute)', () => {
    it('shows login page for unauthenticated users', async () => {
      renderApp('/login');
      await waitFor(() => {
        expect(screen.getByText('auth.signInTo')).toBeInTheDocument();
      });
    });

    it('redirects authenticated users to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/login');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });
  });

  describe('/signup (PublicRoute)', () => {
    it('shows signup page for unauthenticated users', async () => {
      renderApp('/signup');
      await waitFor(() => {
        expect(screen.getByText('auth.createAccount')).toBeInTheDocument();
      });
    });

    it('redirects authenticated users to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/signup');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });
  });

  // ===== LANGUAGE-PREFIXED SIGNUP =====
  describe('/:lang/signup (PublicRoute with lang)', () => {
    it('shows signup page for unauthenticated user at /es/signup', async () => {
      renderApp('/es/signup');
      await waitFor(() => {
        expect(screen.getByText('auth.createAccount')).toBeInTheDocument();
      });
    });

    it('redirects authenticated user at /es/signup to /dashboard', async () => {
      mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      renderApp('/es/signup');
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });
    });
  });

  // ===== DASHBOARD (ProtectedRoute) =====
  describe('/dashboard (ProtectedRoute)', () => {
    it('redirects unauthenticated users to /login', async () => {
      renderApp('/dashboard');
      await waitFor(() => {
        // Redirected to /login, which shows the login page heading
        expect(screen.getByText('auth.signInTo')).toBeInTheDocument();
      });
    });
  });

  // ===== LOADING STATE =====
  describe('loading state', () => {
    it('shows loading spinner while auth is loading on /', async () => {
      mockLoading = true;
      renderApp('/');
      expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('shows loading spinner while auth is loading on /tl', async () => {
      mockLoading = true;
      renderApp('/tl');
      expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('shows loading spinner while auth is loading on /dashboard', async () => {
      mockLoading = true;
      renderApp('/dashboard');
      expect(screen.getByText('common.loading')).toBeInTheDocument();
    });
  });
});
