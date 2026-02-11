import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrustBadge from '../components/TrustBadge';
import type { TrustScoreData } from '../components/dashboard/types';

const baseTrustScore: TrustScoreData = {
  score: 45,
  level: 'verified',
  breakdown: {
    identity: 18,
    reputation: 12,
    social: 8,
    activity: 7,
  },
  signals: {
    identity: {
      emailVerified: true,
      hasGoogle: true,
      hasLinkedin: true,
      linkedinVerified: true,
      humanityVerified: false,
      humanityScore: null,
      hasGithub: true,
    },
    reputation: {
      jobsCompleted: 10,
      completionRate: 0.9,
      avgRating: 4.5,
      reviewCount: 8,
      disputeCount: 0,
    },
    social: {
      vouchCount: 5,
      socialProfilesLinked: 3,
    },
    activity: {
      accountAgeDays: 120,
      daysSinceLastActive: 1,
      profileCompleteness: 0.83,
    },
  },
};

describe('TrustBadge', () => {
  describe('Full mode', () => {
    it('renders trust level badge', () => {
      render(<TrustBadge trustScore={baseTrustScore} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders star rating when reputation is provided', () => {
      render(
        <TrustBadge
          trustScore={baseTrustScore}
          reputation={{ avgRating: 4.5, reviewCount: 8, jobsCompleted: 10 }}
        />
      );
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText('(8 reviews)')).toBeInTheDocument();
    });

    it('renders singular review text', () => {
      render(
        <TrustBadge
          trustScore={baseTrustScore}
          reputation={{ avgRating: 5.0, reviewCount: 1, jobsCompleted: 1 }}
        />
      );
      expect(screen.getByText('(1 review)')).toBeInTheDocument();
    });

    it('does not render star rating when no reviews', () => {
      render(
        <TrustBadge
          trustScore={baseTrustScore}
          reputation={{ avgRating: 0, reviewCount: 0, jobsCompleted: 0 }}
        />
      );
      expect(screen.queryByText('reviews')).not.toBeInTheDocument();
    });

    it('renders vouch count', () => {
      render(<TrustBadge trustScore={baseTrustScore} vouchCount={5} />);
      expect(screen.getByText('5 vouches')).toBeInTheDocument();
    });

    it('renders singular vouch text', () => {
      render(<TrustBadge trustScore={baseTrustScore} vouchCount={1} />);
      expect(screen.getByText('1 vouch')).toBeInTheDocument();
    });

    it('does not render vouch when count is 0', () => {
      render(<TrustBadge trustScore={baseTrustScore} vouchCount={0} />);
      expect(screen.queryByText('vouch')).not.toBeInTheDocument();
    });

    it('renders LinkedIn verified badge', () => {
      render(<TrustBadge trustScore={baseTrustScore} linkedinVerified />);
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    });

    it('renders GitHub verified badge with username', () => {
      render(
        <TrustBadge
          trustScore={baseTrustScore}
          githubVerified
          githubUsername="octocat"
        />
      );
      expect(screen.getByText('GitHub @octocat')).toBeInTheDocument();
    });

    it('renders humanity/ID verified badge', () => {
      render(<TrustBadge trustScore={baseTrustScore} humanityVerified />);
      expect(screen.getByText('ID Verified')).toBeInTheDocument();
    });

    it('renders all verified badges together', () => {
      render(
        <TrustBadge
          trustScore={baseTrustScore}
          linkedinVerified
          githubVerified
          githubUsername="dev"
          humanityVerified
        />
      );
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('GitHub @dev')).toBeInTheDocument();
      expect(screen.getByText('ID Verified')).toBeInTheDocument();
    });

    it('shows expandable breakdown toggle', () => {
      render(<TrustBadge trustScore={baseTrustScore} />);
      expect(screen.getByText('View trust breakdown')).toBeInTheDocument();
    });

    it('expands breakdown on click', async () => {
      const user = userEvent.setup();
      render(<TrustBadge trustScore={baseTrustScore} />);

      await user.click(screen.getByText('View trust breakdown'));

      expect(screen.getByText('Hide details')).toBeInTheDocument();
      expect(screen.getByText('Identity')).toBeInTheDocument();
      expect(screen.getByText('Reputation')).toBeInTheDocument();
      expect(screen.getByText('Social')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('18/30')).toBeInTheDocument();
      expect(screen.getByText('12/40')).toBeInTheDocument();
      expect(screen.getByText('8/15')).toBeInTheDocument();
      expect(screen.getByText('7/15')).toBeInTheDocument();
    });

    it('collapses breakdown on second click', async () => {
      const user = userEvent.setup();
      render(<TrustBadge trustScore={baseTrustScore} />);

      await user.click(screen.getByText('View trust breakdown'));
      expect(screen.getByText('Identity')).toBeInTheDocument();

      await user.click(screen.getByText('Hide details'));
      expect(screen.queryByText('Identity')).not.toBeInTheDocument();
    });
  });

  describe('Trust levels', () => {
    it('renders "New" for new level', () => {
      render(<TrustBadge trustScore={{ score: 5, level: 'new' }} />);
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('renders "Basic" for basic level', () => {
      render(<TrustBadge trustScore={{ score: 20, level: 'basic' }} />);
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('renders "Verified" for verified level', () => {
      render(<TrustBadge trustScore={{ score: 45, level: 'verified' }} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders "Trusted" for trusted level', () => {
      render(<TrustBadge trustScore={{ score: 75, level: 'trusted' }} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('renders compact badge with level', () => {
      render(
        <TrustBadge
          trustScore={{ score: 45, level: 'verified' }}
          compact
        />
      );
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders compact badge with rating', () => {
      render(
        <TrustBadge
          trustScore={{ score: 45, level: 'verified' }}
          reputation={{ avgRating: 4.8, reviewCount: 12, jobsCompleted: 15 }}
          compact
        />
      );
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText('(12)')).toBeInTheDocument();
    });

    it('does not show level badge for new users in compact mode', () => {
      render(
        <TrustBadge
          trustScore={{ score: 5, level: 'new' }}
          compact
        />
      );
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('does not show verified badges in compact mode', () => {
      render(
        <TrustBadge
          trustScore={{ score: 45, level: 'verified' }}
          linkedinVerified
          githubVerified
          compact
        />
      );
      expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument();
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    });

    it('does not show vouch count in compact mode', () => {
      render(
        <TrustBadge
          trustScore={{ score: 45, level: 'verified' }}
          vouchCount={5}
          compact
        />
      );
      expect(screen.queryByText('5 vouches')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles undefined trustScore gracefully', () => {
      render(<TrustBadge />);
      // When trustScore is undefined, no trust level badge is rendered
      expect(screen.queryByText('New')).not.toBeInTheDocument();
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('handles score of 0', () => {
      render(<TrustBadge trustScore={{ score: 0, level: 'new' }} />);
      expect(screen.getByText('New')).toBeInTheDocument();
      // Score of 0 should not show (0) in parentheses
      expect(screen.queryByText('(0)')).not.toBeInTheDocument();
    });

    it('does not show breakdown toggle when breakdown is missing', () => {
      render(<TrustBadge trustScore={{ score: 20, level: 'basic' }} />);
      expect(screen.queryByText('View trust breakdown')).not.toBeInTheDocument();
    });
  });
});
