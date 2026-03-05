import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockProfile } from './mocks';
import CareersPage from '../pages/CareersPage';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockTrack = vi.fn();
const mockPosthogCapture = vi.fn();
const mockSetApplyIntent = vi.fn();
const mockGetApplyIntent = vi.fn();
const mockClearApplyIntent = vi.fn();
const mockSubmitCareerApplication = vi.fn();
const mockGetProfile = vi.fn();

let mockUseAuthReturn: any;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));
vi.mock('../lib/analytics', () => ({
  analytics: { track: (...args: any[]) => mockTrack(...args) },
}));
vi.mock('../lib/posthog', () => ({
  posthog: { capture: (...args: any[]) => mockPosthogCapture(...args) },
}));
const mockGetReferralCode = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    submitCareerApplication: (...args: any[]) => mockSubmitCareerApplication(...args),
    getProfile: () => mockGetProfile(),
    getReferralCode: () => mockGetReferralCode(),
  },
}));
vi.mock('../lib/applyIntent', () => ({
  setApplyIntent: (...args: any[]) => mockSetApplyIntent(...args),
  getApplyIntent: () => mockGetApplyIntent(),
  clearApplyIntent: () => mockClearApplyIntent(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApplyIntent.mockReturnValue(null);
  mockSubmitCareerApplication.mockResolvedValue({});
  mockGetProfile.mockResolvedValue(mockProfile);
  mockGetReferralCode.mockResolvedValue({ referralCode: 'TEST123' });
  mockUseAuthReturn = {
    user: { id: 'test-id', name: 'Test User', email: 'test@example.com' },
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithLinkedIn: vi.fn(),
  };
  window.history.replaceState({}, '', '/careers');
});

afterEach(() => {
  cleanup();
});

// ─── Helper: open modal by clicking a position card's Apply Now ─────────────
// Note: applyButtons[0] is the NAV bar scroll button, not a position card.
// Position card "Apply Now" buttons start from index 1.

async function submitApplication() {
  const user = userEvent.setup();
  renderWithProviders(<CareersPage />);

  // Click a position card's Apply Now (skip nav bar button at index 0)
  const applyButtons = screen.getAllByRole('button', { name: /apply now/i });
  await user.click(applyButtons[1]);

  // Wait for dialog to appear
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  const dialog = screen.getByRole('dialog');

  // Fill the form and submit
  const textarea = within(dialog).getByPlaceholderText(/couple sentences/i);
  await user.type(textarea, 'I love building things!');
  await user.click(within(dialog).getByRole('button', { name: /submit application/i }));

  // Wait for success screen
  await waitFor(() => {
    expect(within(dialog).getByText(/application received/i)).toBeInTheDocument();
  });

  // Wait for profile fetch + referral section animation (500ms delay)
  await waitFor(() => {
    expect(within(dialog).getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
  }, { timeout: 3000 });

  return user;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CareersPage — referral sharing after application', () => {
  it('shows success screen and referral section after submitting application', async () => {
    await submitApplication();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/application received/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/complete my profile/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/know someone who'd be a great fit/i)).toBeInTheDocument();
  });

  it('fetches profile to get referral code on success', async () => {
    await submitApplication();
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it('displays the user referral link with their code', async () => {
    await submitApplication();
    expect(screen.getByText(/signup\?ref=TEST123/)).toBeInTheDocument();
  });

  it('shows WhatsApp, Facebook, and LinkedIn share buttons', async () => {
    await submitApplication();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('WhatsApp')).toBeInTheDocument();
    expect(within(dialog).getByText('Facebook')).toBeInTheDocument();
    expect(within(dialog).getByText('LinkedIn')).toBeInTheDocument();
  });

  it('does NOT show Telegram or X share buttons', async () => {
    await submitApplication();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Telegram')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('X')).not.toBeInTheDocument();
  });

  it('shows reward milestones with tier values', async () => {
    await submitApplication();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/reward milestones/i)).toBeInTheDocument();
    expect(within(dialog).getByText('credits / signup')).toBeInTheDocument();
    expect(within(dialog).getByText('at 10 referrals')).toBeInTheDocument();
    expect(within(dialog).getByText('at 100 referrals')).toBeInTheDocument();
  });

  it('copy button copies referral link and tracks analytics', async () => {
    const user = await submitApplication();

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    const dialog = screen.getByRole('dialog');
    const copyBtn = within(dialog).getByRole('button', { name: /copy/i });
    await user.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('/signup?ref=TEST123')
    );
    expect(mockTrack).toHaveBeenCalledWith('careers_referral_copy', { source: 'apply_success' });
    expect(mockPosthogCapture).toHaveBeenCalledWith('careers_referral_link_copied');
  });

  it('copy button shows "Copied!" feedback after click', async () => {
    const user = await submitApplication();

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  it('WhatsApp share link contains a casual, personal message', async () => {
    await submitApplication();

    const whatsappLink = screen.getByText('WhatsApp').closest('a');
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('cool platform')));
  });

  it('Facebook share link uses the referral URL', async () => {
    await submitApplication();

    const fbLink = screen.getByText('Facebook').closest('a');
    expect(fbLink).toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'));
    expect(fbLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
  });

  it('LinkedIn share link uses the referral URL', async () => {
    await submitApplication();

    const linkedinLink = screen.getByText('LinkedIn').closest('a');
    expect(linkedinLink).toHaveAttribute('href', expect.stringContaining('linkedin.com/sharing'));
    expect(linkedinLink).toHaveAttribute('href', expect.stringContaining('ref%3DTEST123'));
  });

  it('all share buttons open in new tab with noopener', async () => {
    await submitApplication();

    for (const label of ['WhatsApp', 'Facebook', 'LinkedIn']) {
      const link = screen.getByText(label).closest('a');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('clicking a share button tracks analytics with platform name', async () => {
    const user = await submitApplication();

    await user.click(screen.getByText('Facebook'));

    expect(mockTrack).toHaveBeenCalledWith('careers_referral_share', {
      platform: 'facebook',
      source: 'apply_success',
    });
    expect(mockPosthogCapture).toHaveBeenCalledWith('careers_referral_shared', {
      platform: 'facebook',
    });
  });

  it('does NOT show referral section when profile fetch fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const applyButtons = screen.getAllByRole('button', { name: /apply now/i });
    await user.click(applyButtons[1]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText(/couple sentences/i);
    await user.type(textarea, 'I love building things!');
    await user.click(within(dialog).getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/application received/i)).toBeInTheDocument();
    });

    // Wait enough time for fetch to fail + animation
    await new Promise((r) => setTimeout(r, 1000));

    expect(within(dialog).queryByText(/know someone who'd be a great fit/i)).not.toBeInTheDocument();
  });

  it('does NOT show referral section when profile has no referral code', async () => {
    mockGetProfile.mockResolvedValue({ ...mockProfile, referralCode: '' });

    const user = userEvent.setup();
    renderWithProviders(<CareersPage />);

    const applyButtons = screen.getAllByRole('button', { name: /apply now/i });
    await user.click(applyButtons[1]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByPlaceholderText(/couple sentences/i);
    await user.type(textarea, 'I love building things!');
    await user.click(within(dialog).getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/application received/i)).toBeInTheDocument();
    });

    await new Promise((r) => setTimeout(r, 1000));

    expect(within(dialog).queryByText(/know someone who'd be a great fit/i)).not.toBeInTheDocument();
  });
});
