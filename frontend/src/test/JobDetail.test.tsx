import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import JobDetail from '../pages/JobDetail';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getJob: vi.fn(),
    getJobMessages: vi.fn(),
    getAgent: vi.fn(),
    sendJobMessage: vi.fn(),
    acceptJob: vi.fn(),
    rejectJob: vi.fn(),
    completeJob: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'human-1', name: 'Test User', hasWallet: true },
    loading: false,
  }),
}));

vi.mock('../lib/posthog', () => ({
  posthog: { capture: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'job-1' }),
    useNavigate: () => vi.fn(),
  };
});

const baseJob = {
  id: 'job-1',
  humanId: 'human-1',
  agentId: 'agent-1',
  title: 'Write docs',
  description: 'Write API docs',
  priceUsdc: '100.00',
  status: 'PAID' as const,
  createdAt: '2026-02-10T10:00:00Z',
  acceptedAt: '2026-02-11T10:00:00Z',
  paidAt: '2026-02-12T10:00:00Z',
};

describe('JobDetail – transaction link', () => {
  afterEach(() => { cleanup(); });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getJobMessages).mockResolvedValue([]);
    vi.mocked(api.getAgent).mockRejectedValue(new Error('not found'));
  });

  it('shows "View transaction" link when paymentTxHash and paymentNetwork are present', async () => {
    vi.mocked(api.getJob).mockResolvedValue({
      ...baseJob,
      paymentTxHash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
      paymentNetwork: 'base',
    });

    renderWithProviders(<JobDetail />);

    await waitFor(() => {
      expect(screen.getByText('jobDetail.viewTransaction')).toBeInTheDocument();
    });

    const link = screen.getByText('jobDetail.viewTransaction').closest('a');
    expect(link).toHaveAttribute('href', 'https://basescan.org/tx/0xabc123def456789012345678901234567890123456789012345678901234abcd');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not show "View transaction" link when paymentTxHash is missing', async () => {
    vi.mocked(api.getJob).mockResolvedValue({
      ...baseJob,
      paymentTxHash: undefined,
      paymentNetwork: 'base',
    });

    renderWithProviders(<JobDetail />);

    await waitFor(() => {
      expect(screen.getByText('Write docs')).toBeInTheDocument();
    });

    expect(screen.queryByText('jobDetail.viewTransaction')).not.toBeInTheDocument();
  });

  it('does not show "View transaction" link for pending jobs without payment', async () => {
    vi.mocked(api.getJob).mockResolvedValue({
      ...baseJob,
      status: 'PENDING' as const,
      paidAt: undefined,
      paymentTxHash: undefined,
      paymentNetwork: undefined,
    });

    renderWithProviders(<JobDetail />);

    await waitFor(() => {
      expect(screen.getByText('Write docs')).toBeInTheDocument();
    });

    expect(screen.queryByText('jobDetail.viewTransaction')).not.toBeInTheDocument();
  });

  it('links to correct explorer for ethereum network', async () => {
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    vi.mocked(api.getJob).mockResolvedValue({
      ...baseJob,
      paymentTxHash: txHash,
      paymentNetwork: 'ethereum',
    });

    renderWithProviders(<JobDetail />);

    await waitFor(() => {
      expect(screen.getByText('jobDetail.viewTransaction')).toBeInTheDocument();
    });

    const link = screen.getByText('jobDetail.viewTransaction').closest('a');
    expect(link).toHaveAttribute('href', `https://etherscan.io/tx/${txHash}`);
  });
});
