import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

type Tab = 'log' | 'outbox';

const STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-green-100 text-green-700',
  QUEUED: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
};

function relativeTime(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GB');
}

export default function AdminEmails() {
  const [tab, setTab] = useState<Tab>('log');
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [jobIdFilter, setJobIdFilter] = useState('');

  const limit = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminEmails({
        page,
        limit,
        tab,
        status: statusFilter || undefined,
        recipient: recipientFilter || undefined,
        type: typeFilter || undefined,
        jobId: jobIdFilter || undefined,
      });
      setEntries(res.entries);
      setTotal(res.total);
      if (res.statusCounts) setStatusCounts(res.statusCounts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, page, statusFilter, recipientFilter, typeFilter, jobIdFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, recipientFilter, typeFilter, jobIdFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 border-b border-gray-200">
          {(['log', 'outbox'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'log' ? 'Email Log' : 'Outbox (Retry Queue)'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="ml-auto px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Refresh
        </button>
      </div>

      {/* Status summary for log tab */}
      {tab === 'log' && Object.keys(statusCounts).length > 0 && (
        <div className="flex gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusFilter === status ? 'ring-2 ring-blue-400' : ''
              } ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}
            >
              {status}: {count}
            </button>
          ))}
          <span className="px-3 py-1 text-xs text-gray-500">Total: {total}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter by recipient..."
          value={recipientFilter}
          onChange={(e) => setRecipientFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded w-60"
        />
        {tab === 'log' && (
          <>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">All types</option>
              <option value="job_offer">Job Offer</option>
              <option value="job_updated">Job Updated</option>
              <option value="job_message">Job Message</option>
              <option value="moderation_delay">Moderation Delay</option>
              <option value="verification">Verification</option>
              <option value="digest">Digest</option>
            </select>
            <input
              type="text"
              placeholder="Job ID..."
              value={jobIdFilter}
              onChange={(e) => setJobIdFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded w-48"
            />
          </>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded"
        >
          <option value="">All statuses</option>
          <option value="SENT">Sent</option>
          <option value="QUEUED">Queued</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Recipient</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Subject</th>
              {tab === 'log' && (
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              )}
              {tab === 'outbox' && (
                <>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Channel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Attempts</th>
                </>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No entries found</td></tr>
            ) : entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-700'}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-900 max-w-[200px] truncate" title={entry.recipient}>
                  {entry.recipient}
                </td>
                <td className="px-4 py-2 text-gray-700 max-w-[300px] truncate" title={entry.subject || ''}>
                  {entry.subject || '—'}
                </td>
                {tab === 'log' && (
                  <td className="px-4 py-2 text-gray-500">
                    {entry.type ? (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">{entry.type}</span>
                    ) : '—'}
                  </td>
                )}
                {tab === 'outbox' && (
                  <>
                    <td className="px-4 py-2 text-gray-500">{entry.channel}</td>
                    <td className="px-4 py-2 text-gray-500">{entry.attempts}</td>
                  </>
                )}
                <td className="px-4 py-2 text-red-600 max-w-[200px] truncate" title={entry.error || entry.lastError || ''}>
                  {entry.error || entry.lastError || '—'}
                </td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap" title={new Date(entry.createdAt).toLocaleString()}>
                  {relativeTime(entry.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
