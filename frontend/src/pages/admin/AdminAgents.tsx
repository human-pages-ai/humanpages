import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { AdminAgent, Pagination } from '../../types/admin';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  BANNED: 'bg-red-100 text-red-800',
};

export default function AdminAgents() {
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminAgents({ page, limit: 20, search, status });
      setAgents(res.agents);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jobs</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reports</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abuse</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Active</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No agents found</td></tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {a.name}
                    {a.websiteUrl && (
                      <a href={a.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-indigo-500 text-xs">link</a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[a.status] || 'bg-gray-100 text-gray-800'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.activationTier}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a._count.jobs}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a._count.reports}</td>
                  <td className="px-4 py-3 text-sm">
                    {a.abuseStrikes > 0
                      ? <span className="text-red-600">{a.abuseScore} / {a.abuseStrikes} strikes</span>
                      : <span className="text-gray-400">{a.abuseScore}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.lastActiveAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
