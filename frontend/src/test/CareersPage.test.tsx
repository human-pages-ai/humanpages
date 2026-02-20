import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockProfile } from './mocks';
import CareersPage from '../pages/CareersPage';
import { POSITIONS, GENERAL_APPLICATION } from '../data/positions';

// ─── Shared mocks ──────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockTrack = vi.fn();
const mockPosthogCapture = vi.fn();
const mockSetApplyIntent = vi.fn();
const mockGetApplyIntent = vi.fn();
const mockClearApplyIntent = vi.fn();
const mockSubmitCareerApplication = vi.fn();
const mockGetProfile = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));

vi.mock('../lib/analytics', () => ({
  analytics: { track: (...args: any[]) => mockTrack(...args) },
}));

vi.mock('../lib/posthog', () => ({
  posthog: { capture: (...args: any[]) => mockPosthogCapture(...args) },
}));

vi.mock('../lib/api', () => ({
  api: {
    submitCareerApplication: (...args: any[]) => mockSubmitCareerApplication(...args),
    getProfile: () => mockGetProfile(),
  },
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

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Get "Apply Now" buttons from position cards only (skip nav/mobile bar buttons).
 * Position card buttons are inside elements with id="position-{id}".
 */
function getPositionApplyButtons() {
  return screen.getAllByRole('button', { name: /apply now/i }).filter((btn) => {
    // Position card Apply Now buttons are inside elements with id starting with "position-"
    return btn.closest('[id^="position-"]') !== null;
  });
}

/**
 * Check if a position card is rendered by looking for its container element.
 * This avoids issues with titles appearing in team quotes or other sections.
 */
function isPositionCardVisible(positionId: string) {
  return document.getElementById(`position-${positionId}`) !== null;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApplyIntent.mockReturnValue(null);
  mockSubmitCareerApplication.mockResolvedValue({});
  mockGetProfile.mockResolvedValue(mockProfile);
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
    expect(screen.getAllByText(/apply/i).length).toBeGreaterThan(0);
  });

  it('renders all category filter buttons', () => {
    renderWithProviders(<CareersPage />);

    for (const cat of ['All', 'Marketing', 'Engineering', 'Operations', 'Creative', 'Business']) {
      expect(screen.getByRole('button', { name: new RegExp(cat) })).toBeInTheDocument();
    }
  });

  it('renders all position cards with titles and Apply buttons', () => {
    renderWithProviders(<CareersPage />);

    // Every position should have a visible card
    for (const pos of POSITIONS) {
      expect(isPositionCardVisible(pos.id)).toBe(true);
    }

    // Each position card gets an "Apply Now" button
    const applyButtons = getPositionApplyButtons();
    expect(applyButtons.length).toBe(POSITIONS.length);
  });

  it('renders the "Don\'t see your role?" section', () => {
    renderWithProviders(<CareersPage />);

    expect(screen.getByText(/don't see your role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply anyway/i })).toBeInTheDocument();
  });

  it('renders LinkedIn and Google signup buttons in hero for unauthenticated users', () => {
    renderWithProviders(<CareersPage />);

    expect(screen.getByText(/or sign up in 10 seconds/i)).toBeInTheDocument();
    const linkedinButtons = screen.getAllByText(/linkedin/i);
    const googleButtons = screen.getAllByText(/google/i);
    expect(linkedinButtons.length).toBeGreaterThan(0);
    expect(googleButtons.length).toBeGreaterThan(0);
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
      expect(isPositionCardVisible(pos.id)).toBe(true);
    }
    for (const pos of otherPositions) {
      expect(isPositionCardVisible(pos.id)).toBe(false);
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
      expect(isPositionCardVisible(pos.id)).toBe(true);
    }
  });
});

// ─── Modal Flow ────────────────────────────────────────────────────────────

describe('CareersPage — modal flow', () => {
  it('clicking "Apply Now" on a position card opens modal with correct position title', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    // Modal should show the first position's title (may appear in card + modal header)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(POSITIONS[0].title).length).toBeGreaterThanOrEqual(1);
  });

  it('unauthenticated user sees LinkedIn-first intro step with OAuth buttons', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    expect(screen.getByText(/continue with linkedin/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('authenticated user sees form step directly', async () => {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    };

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    expect(screen.getByText(/what excites you about this role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what excites you/i)).toBeInTheDocument();
  });

  it('submit button is disabled when about field is empty, enabled when filled', async () => {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    };

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    const submitBtn = screen.getByRole('button', { name: /submit application/i });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/what excites you/i), 'I love building things!');
    expect(submitBtn).toBeEnabled();
  });

  it('modal closes on ESC key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('modal closes on backdrop click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─── Apply Intent & Analytics ──────────────────────────────────────────────

describe('CareersPage — apply intent & analytics', () => {
  it('tracks analytics on Apply Now click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    expect(mockTrack).toHaveBeenCalledWith('careers_apply_click', {
      position: POSITIONS[0].id,
    });
  });

  it('clicking "Continue with LinkedIn" sets apply intent and calls loginWithLinkedIn', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);
    await user.click(screen.getByText(/continue with linkedin/i));

    expect(mockSetApplyIntent).toHaveBeenCalledWith(POSITIONS[0].id, POSITIONS[0].title);
    expect(mockUseAuthReturn.loginWithLinkedIn).toHaveBeenCalled();
  });

  it('clicking "Continue with Google" sets apply intent and calls loginWithGoogle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);
    await user.click(screen.getByText(/continue with google/i));

    expect(mockSetApplyIntent).toHaveBeenCalledWith(POSITIONS[0].id, POSITIONS[0].title);
    expect(mockUseAuthReturn.loginWithGoogle).toHaveBeenCalled();
  });

  it('calls setApplyIntent on "Sign in" link click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    // "Sign in" link is inside the modal intro step
    const dialog = screen.getByRole('dialog');
    const signInLink = dialog.querySelector('a[href*="/login"]') as HTMLElement;
    expect(signInLink).toBeTruthy();
    await user.click(signInLink);

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

  it('hero LinkedIn button sets general apply intent and calls loginWithLinkedIn', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    // Find the hero LinkedIn button — it's inside the hero section and says just "LinkedIn"
    const heroLinkedInButtons = screen.getAllByText(/linkedin/i);
    await user.click(heroLinkedInButtons[0]);

    expect(mockSetApplyIntent).toHaveBeenCalledWith('general', 'General Application');
    expect(mockTrack).toHaveBeenCalledWith('careers_hero_signup', { method: 'linkedin' });
  });
});

// ─── Referral Sharing (post-apply success) ───────────────────────────────

describe('CareersPage — referral sharing after application', () => {
  // Helper: go through the full apply flow as an authenticated user
  async function submitApplication() {
    mockUseAuthReturn = {
      ...mockUseAuthReturn,
      user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    };

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    // Open modal — click a position card's Apply Now button (not the nav button)
    const positionApplyBtns = getPositionApplyButtons();
    await user.click(positionApplyBtns[0]);

    // Wait for form step to render (the useEffect sets step based on user)
    const textarea = await screen.findByLabelText(/what excites you/i);
    await user.type(textarea, 'I love building things!');
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    // Wait for success step to render
    await waitFor(() => {
      expect(screen.getByText(/application received/i)).toBeInTheDocument();
    });

    return user;
  }

  it('shows success screen after submitting application', async () => {
    await submitApplication();

    expect(screen.getByText(/application received/i)).toBeInTheDocument();
    expect(screen.getByText(/complete my profile/i)).toBeInTheDocument();
  });

  it('fetches profile to get referral code on success', async () => {
    await submitApplication();

    expect(mockGetProfile).toHaveBeenCalled();
  });

  it('displays referral sharing section with referral link after success', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/signup\?ref=TEST123/)).toBeInTheDocument();
  });

  it('shows share message copy and all three share buttons (WhatsApp, Facebook, LinkedIn)', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/share your link and earn credits/i)).toBeInTheDocument();

    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    // "LinkedIn" appears in referral share section
    expect(screen.getAllByText('LinkedIn').length).toBeGreaterThan(0);
  });

  it('does NOT show Telegram or X share buttons', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Telegram')).not.toBeInTheDocument();
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });

  it('displays reward milestones with correct tier values', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText(/reward milestones/i)).toBeInTheDocument();
    });

    expect(screen.getByText('credits / signup')).toBeInTheDocument();
    expect(screen.getByText('at 10 referrals')).toBeInTheDocument();
    expect(screen.getByText('at 100 referrals')).toBeInTheDocument();
  });

  it('copy button copies referral link and tracks analytics', async () => {
    // Ensure clipboard API is available (jsdom may not define it)
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    }

    const user = await submitApplication();

    await waitFor(() => {
      expect(screen.getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /copy/i });
    await user.click(copyBtn);

    // The copy handler calls writeText, then tracks analytics on success.
    // Analytics tracking proves the clipboard write completed successfully.
    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith('careers_referral_copy', { source: 'apply_success' });
    });
    expect(mockPosthogCapture).toHaveBeenCalledWith('careers_referral_link_copied');
  });

  it('copy button shows "Copied!" feedback after clicking', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    const user = await submitApplication();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  it('WhatsApp share link contains a personal, non-pushy message', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    const whatsappLink = screen.getByText('WhatsApp').closest('a');
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('cool platform')));
  });

  it('Facebook share link uses the referral URL', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeInTheDocument();
    });

    const fbLink = screen.getByText('Facebook').closest('a');
    expect(fbLink).toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'));
    expect(fbLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
  });

  it('LinkedIn share link uses the referral URL', async () => {
    await submitApplication();

    await waitFor(() => {
      const linkedinElements = screen.getAllByText('LinkedIn');
      expect(linkedinElements.length).toBeGreaterThan(0);
    });

    const linkedinLinks = screen.getAllByText('LinkedIn').map(el => el.closest('a')).filter(Boolean);
    const referralLinkedinLink = linkedinLinks.find(a => a?.getAttribute('href')?.includes('linkedin.com/sharing'));
    expect(referralLinkedinLink).toBeTruthy();
    expect(referralLinkedinLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
  });

  it('share buttons open in a new tab', async () => {
    await submitApplication();

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    for (const label of ['WhatsApp', 'Facebook']) {
      const link = screen.getByText(label).closest('a');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }

    const linkedinLinks = screen.getAllByText('LinkedIn').map(el => el.closest('a')).filter(Boolean);
    const referralLinkedinLink = linkedinLinks.find(a => a?.getAttribute('href')?.includes('linkedin.com/sharing'));
    expect(referralLinkedinLink).toHaveAttribute('target', '_blank');
    expect(referralLinkedinLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('clicking a share button tracks analytics with platform name', async () => {
    const user = await submitApplication();

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    await user.click(screen.getByText('WhatsApp'));

    expect(mockTrack).toHaveBeenCalledWith('careers_referral_share', {
      platform: 'whatsapp',
      source: 'apply_success',
    });
    expect(mockPosthogCapture).toHaveBeenCalledWith('careers_referral_shared', {
      platform: 'whatsapp',
    });
  });

  it('does NOT show referral section when profile fetch fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('Network error'));

    await submitApplication();

    expect(screen.getByText(/application received/i)).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByText(/know someone who'd be a great fit/i)).not.toBeInTheDocument();
  });

  it('does NOT show referral section when profile has no referral code', async () => {
    mockGetProfile.mockResolvedValue({ ...mockProfile, referralCode: '' });

    await submitApplication();

    expect(screen.getByText(/application received/i)).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByText(/know someone who'd be a great fit/i)).not.toBeInTheDocument();
  });
});
