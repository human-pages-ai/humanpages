import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  error: 'bg-orange-100 text-orange-700',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  job_posting: 'Job Posting',
  profile_photo: 'Profile Photo',
  human_report: 'Human Report',
  agent_report: 'Agent Report',
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

export default function AdminModeration() {
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminModeration({
        page,
        limit: 20,
        status: statusFilter || undefined,
        contentType: contentTypeFilter || undefined,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, contentTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, contentTypeFilter]);

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    setActionLoading(id);
    try {
      await api.patchAdminModeration(id, status);
      // Update item in place
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, status, reviewedAt: new Date().toISOString() } : item
      ));
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Moderation Queue</h2>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="error">Error</option>
        </select>
        <select
          value={contentTypeFilter}
          onChange={(e) => setContentTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded"
        >
          <option value="">All types</option>
          <option value="job_posting">Job Posting</option>
          <option value="profile_photo">Profile Photo</option>
          <option value="human_report">Human Report</option>
          <option value="agent_report">Agent Report</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Content ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Attempts</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Reviewed</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No moderation items found</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-700">
                  {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
                </td>
                <td className="px-4 py-2">
                  {item.contentType === 'job_posting' ? (
                    <a href={`/admin/jobs/${item.contentId}`} className="text-blue-600 hover:underline font-mono text-xs">
                      {item.contentId}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-gray-600">{item.contentId}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">{item.attempts}</td>
                <td className="px-4 py-2 text-red-600 max-w-[200px] truncate" title={item.errorMessage || ''}>
                  {item.errorMessage || '—'}
                </td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap" title={new Date(item.createdAt).toLocaleString()}>
                  {relativeTime(item.createdAt)}
                </td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                  {item.reviewedAt ? relativeTime(item.reviewedAt) : '—'}
                </td>
                <td className="px-4 py-2">
                  {(item.status === 'pending' || item.status === 'error') ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAction(item.id, 'approved')}
                        disabled={actionLoading === item.id}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'rejected')}
                        disabled={actionLoading === item.id}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Done</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
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
