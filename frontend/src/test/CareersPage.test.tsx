import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './mocks';
import CareersPage from '../pages/CareersPage';
import { POSITIONS, GENERAL_APPLICATION } from '../data/positions';

// ─── Shared mocks ──────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockTrack = vi.fn();
const mockSetApplyIntent = vi.fn();
const mockGetApplyIntent = vi.fn();
const mockClearApplyIntent = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));

vi.mock('../lib/analytics', () => ({
  analytics: { track: (...args: any[]) => mockTrack(...args) },
}));

vi.mock('../lib/applyIntent', () => ({
  setApplyIntent: (...args: any[]) => mockSetApplyIntent(...args),
  getApplyIntent: () => mockGetApplyIntent(),
  clearApplyIntent: () => mockClearApplyIntent(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Default: unauthenticated user
let mockUseAuthReturn: any = {
  user: null,
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithLinkedIn: vi.fn(),
};

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApplyIntent.mockReturnValue(null);
  mockUseAuthReturn = {
    user: null,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithLinkedIn: vi.fn(),
  };
  // Reset URL
  window.history.replaceState({}, '', '/careers');
});

afterEach(() => {
  cleanup();
});

// ─── Page Structure ────────────────────────────────────────────────────────

describe('CareersPage — page structure', () => {
  it('renders hero section with heading and CTA', () => {
    renderWithProviders(<CareersPage />);

    expect(screen.getByText(/build the future of/i)).toBeInTheDocument();
    expect(screen.getByText(/human-ai/i)).toBeInTheDocument();
    expect(screen.getAllByText(/see open positions/i).length).toBeGreaterThan(0);
  });

  it('renders all category filter buttons', () => {
    renderWithProviders(<CareersPage />);

    for (const cat of ['All', 'Marketing', 'Engineering', 'Operations', 'Creative', 'Business']) {
      expect(screen.getByRole('button', { name: new RegExp(cat) })).toBeInTheDocument();
    }
  });

  it('renders all position cards with titles and Apply buttons', () => {
    renderWithProviders(<CareersPage />);

    for (const pos of POSITIONS) {
      expect(screen.getByText(pos.title)).toBeInTheDocument();
    }

    // Each position gets an "Apply Now" button
    const applyButtons = screen.getAllByRole('button', { name: /apply now/i });
    expect(applyButtons.length).toBe(POSITIONS.length);
  });

  it('renders the "Don\'t see your role?" section', () => {
    renderWithProviders(<CareersPage />);

    expect(screen.getByText(/don't see your role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply anyway/i })).toBeInTheDocument();
  });
});

// ─── Category Filtering ────────────────────────────────────────────────────

describe('CareersPage — category filtering', () => {
  it('clicking a category shows only matching positions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const engineeringBtn = screen.getByRole('button', { name: /Engineering/i });
    await user.click(engineeringBtn);

    const engineeringPositions = POSITIONS.filter(p => p.category === 'Engineering');
    const otherPositions = POSITIONS.filter(p => p.category !== 'Engineering');

    for (const pos of engineeringPositions) {
      expect(screen.getByText(pos.title)).toBeInTheDocument();
    }
    for (const pos of otherPositions) {
      expect(screen.queryByText(pos.title)).not.toBeInTheDocument();
    }
  });

  it('clicking "All" restores all positions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    // Filter to Engineering first
    await user.click(screen.getByRole('button', { name: /Engineering/i }));
    // Back to All
    await user.click(screen.getByRole('button', { name: /^All/ }));

    for (const pos of POSITIONS) {
      expect(screen.getByText(pos.title)).toBeInTheDocument();
    }
  });
});

// ─── Modal Flow ────────────────────────────────────────────────────────────

describe('CareersPage — modal flow', () => {
  it('clicking "Apply Now" opens modal with correct position title', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const firstApplyBtn = screen.getAllByRole('button', { name: /apply now/i })[0];
    await user.click(firstApplyBtn);

    // Modal should show the first position's title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(POSITIONS[0].title)).toBeInTheDocument();
  });

  it('unauthenticated user sees intro step with signup CTA', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);

    expect(screen.getByText(/create profile & apply/i)).toBeInTheDocument();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('authenticated user sees form step directly', async () => {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    };

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);

    expect(screen.getByText(/what excites you about this role/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submit button is disabled when about field is empty, enabled when filled', async () => {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    };

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);

    const submitBtn = screen.getByRole('button', { name: /submit application/i });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'I love building things!');
    expect(submitBtn).toBeEnabled();
  });

  it('modal closes on ESC key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('modal closes on backdrop click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);
    const backdrop = screen.getByRole('dialog');
    // Click on the backdrop overlay itself (not the inner modal content)
    await user.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─── Apply Intent & Analytics ──────────────────────────────────────────────

describe('CareersPage — apply intent & analytics', () => {
  it('tracks analytics on Apply Now click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);

    expect(mockTrack).toHaveBeenCalledWith('careers_apply_click', {
      position: POSITIONS[0].id,
    });
  });

  it('calls setApplyIntent and navigates to signup on "Create Profile & Apply" click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);
    await user.click(screen.getByText(/create profile & apply/i));

    expect(mockSetApplyIntent).toHaveBeenCalledWith(POSITIONS[0].id, POSITIONS[0].title);
    expect(mockNavigate).toHaveBeenCalledWith('/signup');
  });

  it('calls setApplyIntent on "Sign in" link click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getAllByRole('button', { name: /apply now/i })[0]);
    await user.click(screen.getByText(/sign in/i));

    expect(mockSetApplyIntent).toHaveBeenCalledWith(POSITIONS[0].id, POSITIONS[0].title);
  });

  it('auto-opens modal when apply intent exists in localStorage on mount', () => {
    mockGetApplyIntent.mockReturnValue({
      positionId: 'software-engineer',
      positionTitle: 'Software Engineer',
      timestamp: Date.now(),
    });

    renderWithProviders(<CareersPage />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockClearApplyIntent).toHaveBeenCalled();
  });

  it('auto-opens modal from ?apply= URL param on mount', () => {
    window.history.replaceState({}, '', '/careers?apply=digital-marketer');

    renderWithProviders(<CareersPage />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // URL param should be cleaned up
    expect(window.location.search).toBe('');
  });

  it('clicking "Apply Anyway" opens modal for general application', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    await user.click(screen.getByRole('button', { name: /apply anyway/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(GENERAL_APPLICATION.title)).toBeInTheDocument();
  });
});
