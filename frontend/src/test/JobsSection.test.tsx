import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import JobsSection from '../components/dashboard/JobsSection';
import { Job } from '../components/dashboard/types';

const baseJob: Job = {
  id: 'job-1',
  agentId: 'agent-1',
  title: 'Write docs',
  description: 'Write API docs',
  priceUsdc: '100.00',
  status: 'PAID',
  createdAt: '2026-02-10T10:00:00Z',
};

const defaultProps = {
  jobsLoading: false,
  jobFilter: 'all' as const,
  setJobFilter: vi.fn(),
  reviewStats: null,
  profileId: 'human-1',
};

describe('JobsSection – transaction link', () => {
  it('shows explorer button for a paid job with paymentTxHash', () => {
    const job: Job = {
      ...baseJob,
      paymentTxHash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
      paymentNetwork: 'polygon',
    };

    renderWithProviders(<JobsSection {...defaultProps} jobs={[job]} />);

    const button = screen.getByTitle('jobDetail.viewTransaction');
    expect(button.tagName).toBe('BUTTON');
  });

  it('does not show explorer button for a job without paymentTxHash', () => {
    renderWithProviders(<JobsSection {...defaultProps} jobs={[baseJob]} />);

    expect(screen.queryByTitle('jobDetail.viewTransaction')).not.toBeInTheDocument();
  });

  it('does not show explorer button for a pending job', () => {
    const job: Job = {
      ...baseJob,
      status: 'PENDING',
    };

    renderWithProviders(<JobsSection {...defaultProps} jobs={[job]} />);

    expect(screen.queryByTitle('jobDetail.viewTransaction')).not.toBeInTheDocument();
  });
});
