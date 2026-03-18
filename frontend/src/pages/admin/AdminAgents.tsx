import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminAgent, Pagination } from '../../types/admin';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  BANNED: 'bg-red-100 text-red-800',
};

type SortKey = 'name' | 'status' | 'tier' | 'jobs' | 'reports' | 'abuse' | 'lastActive' | 'registered';
type SortDir = 'asc' | 'desc';

function sortAgents(agents: AdminAgent[], key: SortKey, dir: SortDir): AdminAgent[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...agents].sort((a, b) => {
    switch (key) {
      case 'name': return mul * a.name.localeCompare(b.name);
      case 'status': return mul * a.status.localeCompare(b.status);
      case 'tier': return mul * a.activationTier.localeCompare(b.activationTier);
      case 'jobs': return mul * (a._count.jobs - b._count.jobs);
      case 'reports': return mul * (a._count.reports - b._count.reports);
      case 'abuse': return mul * (a.abuseScore - b.abuseScore || a.abuseStrikes - b.abuseStrikes);
      case 'lastActive': return mul * (new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime());
      case 'registered': return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default: return 0;
    }
  });
}

export default function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('registered');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedAgents = sortAgents(agents, sortKey, sortDir);

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
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {([['name', 'Name'], ['status', 'Status'], ['tier', 'Tier'], ['jobs', 'Jobs'], ['reports', 'Reports'], ['abuse', 'Abuse'], ['lastActive', 'Last Active'], ['registered', 'Registered']] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-800 select-none"
                >
                  {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No agents found</td></tr>
            ) : (
              sortedAgents.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/agents/${a.id}`)}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link to={`/admin/agents/${a.id}`} className="text-blue-600 hover:text-blue-800 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {a.name}
                    </Link>
                    {a.isVerified && (
                      <span className="ml-1 inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-[10px] px-1 py-0.5 rounded-full font-medium" title="Verified Agent">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    {a.websiteUrl && (
                      <a href={a.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 text-xs" onClick={(e) => e.stopPropagation()}>link</a>
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
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.lastActiveAt).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.createdAt).toLocaleDateString('en-GB')}</td>
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
