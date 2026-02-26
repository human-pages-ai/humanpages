import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminUser, Pagination } from '../../types/admin';

function UserAvatar({ user, size = 32 }: { user: AdminUser; size?: number }) {
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (user.profilePhotoUrl) {
    return (
      <img
        src={user.profilePhotoUrl}
        alt={user.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0 font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function PhotoStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminUsers({ page, limit: 20, search, verified, hasPhoto: hasPhoto || undefined, sort, order });
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, verified, hasPhoto, sort, order]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('desc');
    }
  }

  function sortIndicator(field: string) {
    if (sort !== field) return '';
    return order === 'asc' ? ' \u2191' : ' \u2193';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, email, or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={verified}
          onChange={(e) => setVerified(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All users</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={hasPhoto}
            onChange={(e) => setHasPhoto(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Has photo
        </label>
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`px-3 py-2 text-sm ${viewMode === 'gallery' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Gallery
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {viewMode === 'table' ? (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('email')}>
                  Email{sortIndicator('email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jobs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reviews</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral Link</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('createdAt')}>
                  Joined{sortIndicator('createdAt')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('lastActiveAt')}>
                  Last Active{sortIndicator('lastActiveAt')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/users/${u.id}`)}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={u} size={32} />
                        <div>
                          <Link
                            to={`/admin/users/${u.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {u.name}
                          </Link>
                          {u.username && <span className="ml-1 text-gray-400">@{u.username}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-sm">
                      {u.emailVerified
                        ? <span className="text-green-600 font-medium">Yes</span>
                        : <span className="text-gray-400">No</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u._count.jobs}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u._count.reviews}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${u.referralCode}`); }}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                        title={`${window.location.origin}/signup?ref=${u.referralCode}`}
                      >
                        Copy
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.lastActiveAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No users found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {users.map((u) => (
                <Link
                  key={u.id}
                  to={`/admin/users/${u.id}`}
                  className="bg-white rounded-lg shadow p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow"
                >
                  <UserAvatar user={u} size={128} />
                  <p className="mt-3 text-sm font-medium text-gray-900 truncate w-full">{u.name}</p>
                  {u.username && <p className="text-xs text-gray-400 truncate w-full">@{u.username}</p>}
                  {u.profilePhotoStatus && <div className="mt-2"><PhotoStatusBadge status={u.profilePhotoStatus} /></div>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

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
