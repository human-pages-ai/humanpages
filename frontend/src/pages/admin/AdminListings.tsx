import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Pagination } from '../../types/admin';

interface AdminListing {
  id: string;
  title: string;
  status: string;
  budgetUsdc: string;
  isPro: boolean;
  expiresAt: string;
  createdAt: string;
  agent: { id: string; name: string } | null;
  _count: { applications: number };
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function AdminListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminListings({ page, limit: 20, search, status });
      setListings(res.listings);
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
          placeholder="Search listings..."
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
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apps</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : listings.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No listings found</td></tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/listings/${l.id}`)}>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    <Link to={`/admin/listings/${l.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {l.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[l.status] || 'bg-gray-100 text-gray-800'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {l.agent ? (
                      <Link to={`/admin/agents/${l.agent.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {l.agent.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-600 font-medium">${l.budgetUsdc}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l._count.applications}</td>
                  <td className="px-4 py-3 text-sm">
                    {l.isPro ? (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PRO</span>
                    ) : (
                      <span className="text-xs text-gray-400">BASIC</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(l.expiresAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(l.createdAt).toLocaleDateString()}</td>
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
