import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import AdminOverview from '../pages/admin/AdminOverview';

// ── Mock API ──────────────────────────────────────────────────
const mockGetAdminStats = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    getAdminStats: () => mockGetAdminStats(),
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

// ── Fixtures ──────────────────────────────────────────────────

const fullStats = {
  users: { total: 150, verified: 120, last7d: 15, last30d: 45 },
  agents: { total: 10, byStatus: { ACTIVE: 7, PENDING: 2, SUSPENDED: 1 } },
  jobs: {
    total: 80,
    byStatus: { COMPLETED: 30, PAID: 20, PENDING: 15, ACCEPTED: 10, REJECTED: 3, CANCELLED: 2 },
    last7d: 12,
    last30d: 35,
    paymentVolume: 12500.5,
    paidJobCount: 20,
  },
  reports: { total: 5, pending: 2 },
  affiliates: { total: 8, approved: 6 },
  feedback: { total: 25, new: 3 },
  humanReports: { total: 4, pending: 1 },
  listings: {
    total: 20,
    open: 12,
    byStatus: { OPEN: 12, CLOSED: 5, EXPIRED: 2, CANCELLED: 1 },
    applications: 45,
  },
  insights: {
    cvUploaded: 85,
    telegramConnected: 60,
    telegramBotSignups: 25,
    education: { bachelors: 40, masters: 30, doctorate: 10, other: 15 },
    profileCompleteness: {
      avgScore: 52,
      withBio: 90,
      withPhoto: 45,
      withService: 70,
      withEducation: 95,
      withSkills: 110,
      withLocation: 100,
      available: 130,
      distribution: {
        '0-19': 10,
        '20-39': 25,
        '40-59': 40,
        '60-79': 50,
        '80-100': 25,
      },
    },
    verification: { google: 80, linkedin: 40, github: 30 },
    workMode: { REMOTE: 90, ONSITE: 20, HYBRID: 30 },
    utmSources: { telegram_bot: 25, reddit: 15, facebook: 10, twitter: 5 },
    topSkills: [
      { skill: 'React', count: 45 },
      { skill: 'TypeScript', count: 38 },
      { skill: 'Python', count: 30 },
      { skill: 'Node.js', count: 28 },
      { skill: 'JavaScript', count: 25 },
    ],
    topLocations: [
      { location: 'Lagos, Nigeria', count: 20 },
      { location: 'San Francisco, USA', count: 15 },
      { location: 'Berlin, Germany', count: 10 },
    ],
  },
};

const statsWithoutInsights = {
  users: { total: 10, verified: 5, last7d: 2, last30d: 8 },
  agents: { total: 0, byStatus: {} },
  jobs: { total: 0, byStatus: {}, last7d: 0, last30d: 0, paymentVolume: 0, paidJobCount: 0 },
  reports: { total: 0, pending: 0 },
  affiliates: { total: 0, approved: 0 },
  feedback: { total: 0, new: 0 },
  humanReports: { total: 0, pending: 0 },
  listings: { total: 0, open: 0, byStatus: {}, applications: 0 },
};

// ── Tests ─────────────────────────────────────────────────────

afterEach(cleanup);

describe('AdminOverview', () => {

  describe('Loading state', () => {
    it('should show skeleton loader while loading', () => {
      mockGetAdminStats.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithProviders(<AdminOverview />);

      // Skeleton cards have animate-pulse class — check for skeleton structure
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error state', () => {
    it('should show error message when API fails', async () => {
      mockGetAdminStats.mockRejectedValue(new Error('Network error'));
      renderWithProviders(<AdminOverview />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Core KPIs', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display total users', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('should display total agents', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('Total Agents');
        expect(label).toBeInTheDocument();
        // The value is in the next sibling element within the same card
        const card = label.closest('a, div')!;
        expect(card.textContent).toContain('10');
      });
    });

    it('should display total jobs', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('Total Jobs');
        expect(label).toBeInTheDocument();
        const card = label.closest('a, div')!;
        expect(card.textContent).toContain('80');
      });
    });

    it('should display payment volume formatted as currency', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Payment Volume')).toBeInTheDocument();
        expect(screen.getByText('$12,500.50')).toBeInTheDocument();
      });
    });

    it('should display verified user count with percentage', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('120 verified (80%)')).toBeInTheDocument();
      });
    });
  });

  describe('Status bars', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display agent status bar', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Agent Status')).toBeInTheDocument();
      });
    });

    it('should display job status bar', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Job Status')).toBeInTheDocument();
      });
    });

    it('should display listing status bar', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Listing Status')).toBeInTheDocument();
      });
    });
  });

  describe('Platform Insights section', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display the Platform Insights header', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Platform Insights')).toBeInTheDocument();
      });
    });

    it('should display CV Uploaded stat with ring chart', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('CV Uploaded');
        expect(label).toBeInTheDocument();
        const card = label.closest('.bg-white')!;
        expect(card.textContent).toContain('85');
        expect(card.textContent).toContain('57%');
      });
    });

    it('should display Telegram Connected stat', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('Telegram Connected');
        expect(label).toBeInTheDocument();
        const card = label.closest('.bg-white')!;
        expect(card.textContent).toContain('60');
      });
    });

    it('should display TG Bot Signups stat', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('TG Bot Signups');
        expect(label).toBeInTheDocument();
        const card = label.closest('.bg-white')!;
        expect(card.textContent).toContain('25');
      });
    });

    it('should display Available Now stat', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('Available Now');
        expect(label).toBeInTheDocument();
        const card = label.closest('.bg-white')!;
        expect(card.textContent).toContain('130');
      });
    });
  });

  describe('Onboarding Funnel', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display the onboarding funnel', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Onboarding Funnel')).toBeInTheDocument();
      });
    });

    it('should show all funnel steps', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Email Verified')).toBeInTheDocument();
        expect(screen.getByText('Added Skills')).toBeInTheDocument();
        expect(screen.getByText('Uploaded CV')).toBeInTheDocument();
        expect(screen.getByText('Wrote Bio')).toBeInTheDocument();
        expect(screen.getByText('Set Location')).toBeInTheDocument();
        expect(screen.getByText('Added Education')).toBeInTheDocument();
        expect(screen.getByText('Listed a Service')).toBeInTheDocument();
        expect(screen.getByText('Profile Photo')).toBeInTheDocument();
        expect(screen.getByText('Connected Telegram')).toBeInTheDocument();
      });
    });

    it('should display funnel values with percentages', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        // Email Verified step should contain "120" and "(80%)" in the same row
        const label = screen.getByText('Email Verified');
        const row = label.closest('.flex')!;
        expect(row.textContent).toContain('120');
        expect(row.textContent).toContain('80%');
      });
    });
  });

  describe('Profile Completeness', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display average score badge', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Profile Completeness')).toBeInTheDocument();
        expect(screen.getByText('Avg 52%')).toBeInTheDocument();
      });
    });

    it('should display all five distribution buckets', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText(/0-19%/)).toBeInTheDocument();
        expect(screen.getByText(/20-39%/)).toBeInTheDocument();
        expect(screen.getByText(/40-59%/)).toBeInTheDocument();
        expect(screen.getByText(/60-79%/)).toBeInTheDocument();
        expect(screen.getByText(/80-100%/)).toBeInTheDocument();
      });
    });
  });

  describe('Education Level', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display education breakdown', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Education Level')).toBeInTheDocument();
        expect(screen.getByText('Doctorate')).toBeInTheDocument();
        expect(screen.getByText("Master's")).toBeInTheDocument();
        expect(screen.getByText("Bachelor's")).toBeInTheDocument();
        expect(screen.getByText('Other')).toBeInTheDocument();
      });
    });

    it('should show total users with education', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        // 40 + 30 + 10 + 15 = 95
        expect(screen.getByText('95 users with education data')).toBeInTheDocument();
      });
    });
  });

  describe('Verification Methods', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display all verification methods', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Verification Methods')).toBeInTheDocument();
        expect(screen.getByText('Google')).toBeInTheDocument();
        expect(screen.getByText('LinkedIn')).toBeInTheDocument();
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });
    });
  });

  describe('Work Mode', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display work mode distribution', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const label = screen.getByText('Work Mode');
        expect(label).toBeInTheDocument();
        const card = label.closest('.bg-white')!;
        // Check all 3 modes are shown
        expect(card.textContent).toContain('Remote');
        expect(card.textContent).toContain('Onsite');
        expect(card.textContent).toContain('Hybrid');
        expect(card.textContent).toContain('90');
        expect(card.textContent).toContain('20');
      });
    });
  });

  describe('Acquisition & Discovery', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should display UTM sources', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Signup Sources (UTM)')).toBeInTheDocument();
        expect(screen.getByText('telegram_bot')).toBeInTheDocument();
        expect(screen.getByText('reddit')).toBeInTheDocument();
      });
    });

    it('should display top skills', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        expect(screen.getByText('Top Skills')).toBeInTheDocument();
        expect(screen.getByText('React')).toBeInTheDocument();
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(screen.getByText('Python')).toBeInTheDocument();
      });
    });

    // Top Locations section was removed from the component
  });

  describe('Without insights data (backwards compatibility)', () => {
    it('should render core stats without insights section', async () => {
      mockGetAdminStats.mockResolvedValue(statsWithoutInsights);
      renderWithProviders(<AdminOverview />);

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });

      // Insights section should not render
      expect(screen.queryByText('Platform Insights')).not.toBeInTheDocument();
      expect(screen.queryByText('CV Uploaded')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero total users gracefully (no division by zero)', async () => {
      const zeroStats = {
        ...statsWithoutInsights,
        users: { total: 0, verified: 0, last7d: 0, last30d: 0 },
        insights: {
          cvUploaded: 0,
          telegramConnected: 0,
          telegramBotSignups: 0,
          education: { bachelors: 0, masters: 0, doctorate: 0, other: 0 },
          profileCompleteness: {
            avgScore: 0,
            withBio: 0,
            withPhoto: 0,
            withService: 0,
            withEducation: 0,
            withSkills: 0,
            withLocation: 0,
            available: 0,
            distribution: { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 },
          },
          verification: { google: 0, linkedin: 0, github: 0 },
          workMode: {},
          utmSources: {},
          topSkills: [],
          topLocations: [],
        },
      };
      mockGetAdminStats.mockResolvedValue(zeroStats);
      renderWithProviders(<AdminOverview />);

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('Platform Insights')).toBeInTheDocument();
        // 0% should appear without NaN
        expect(screen.queryByText('NaN')).not.toBeInTheDocument();
      });
    });

    it('should handle empty topSkills and topLocations arrays', async () => {
      const emptyListStats = {
        ...fullStats,
        insights: {
          ...fullStats.insights,
          topSkills: [],
          topLocations: [],
          utmSources: {},
        },
      };
      mockGetAdminStats.mockResolvedValue(emptyListStats);
      renderWithProviders(<AdminOverview />);

      await waitFor(() => {
        expect(screen.getByText('Top Skills')).toBeInTheDocument();
        // Should show "No data" for empty skills
        const noDataElements = screen.getAllByText('No data');
        expect(noDataElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Links and navigation', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should link Total Users card to /admin/users', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const link = screen.getByText('Total Users').closest('a');
        expect(link).toHaveAttribute('href', '/admin/users');
      });
    });

    it('should link Total Agents card to /admin/agents', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const link = screen.getByText('Total Agents').closest('a');
        expect(link).toHaveAttribute('href', '/admin/agents');
      });
    });

    it('should link Total Jobs card to /admin/jobs', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const link = screen.getByText('Total Jobs').closest('a');
        expect(link).toHaveAttribute('href', '/admin/jobs');
      });
    });

    it('should link Feedback card to /admin/feedback', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const link = screen.getByText('Feedback').closest('a');
        expect(link).toHaveAttribute('href', '/admin/feedback');
      });
    });
  });

  describe('SVG ring charts', () => {
    beforeEach(() => {
      mockGetAdminStats.mockResolvedValue(fullStats);
    });

    it('should render SVG ring charts for engagement KPIs', async () => {
      renderWithProviders(<AdminOverview />);
      await waitFor(() => {
        const svgs = document.querySelectorAll('svg');
        // 4 ring charts for CV, TG, TG Bot, Available
        expect(svgs.length).toBeGreaterThanOrEqual(4);
      });
    });
  });
});
