import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminStats } from '../../types/admin';

function StatCard({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to?: string }) {
  const content = (
    <>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="bg-white rounded-lg shadow p-5 hover:ring-2 hover:ring-blue-200 transition-all block">
        {content}
      </Link>
    );
  }

  return <div className="bg-white rounded-lg shadow p-5">{content}</div>;
}

function StatusBar({ data, colorMap, linkPrefix }: { data: Record<string, number>; colorMap: Record<string, string>; linkPrefix?: string }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-sm text-gray-400">No data</p>;

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {Object.entries(data).map(([status, count]) => (
          <div
            key={status}
            className={colorMap[status] || 'bg-gray-300'}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${status}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(data).map(([status, count]) => (
          linkPrefix ? (
            <Link key={status} to={`${linkPrefix}?status=${status}`} className="text-xs text-gray-500 hover:text-blue-600">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${colorMap[status] || 'bg-gray-300'}`} />
              {status}: {count}
            </Link>
          ) : (
            <span key={status} className="text-xs text-gray-500">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${colorMap[status] || 'bg-gray-300'}`} />
              {status}: {count}
            </span>
          )
        ))}
      </div>
    </div>
  );
}

const agentColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  PENDING: 'bg-yellow-400',
  SUSPENDED: 'bg-blue-600',
  BANNED: 'bg-red-500',
};

const listingColors: Record<string, string> = {
  OPEN: 'bg-green-500',
  CLOSED: 'bg-blue-500',
  EXPIRED: 'bg-gray-400',
  CANCELLED: 'bg-red-400',
};

const jobColors: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  PAID: 'bg-blue-500',
  ACCEPTED: 'bg-blue-400',
  PENDING: 'bg-yellow-400',
  REJECTED: 'bg-gray-400',
  CANCELLED: 'bg-gray-300',
  DISPUTED: 'bg-red-500',
};

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading stats...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          sub={`${stats.users.verified} verified`}
          to="/admin/users"
        />
        <StatCard
          label="Total Agents"
          value={stats.agents.total}
          sub={`${stats.agents.byStatus['ACTIVE'] || 0} active`}
          to="/admin/agents"
        />
        <StatCard
          label="Total Jobs"
          value={stats.jobs.total}
          sub={`${stats.jobs.last7d} in last 7d`}
          to="/admin/jobs"
        />
        <StatCard
          label="Payment Volume"
          value={`$${stats.jobs.paymentVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${stats.jobs.paidJobCount ?? stats.jobs.byStatus['PAID'] ?? 0} paid jobs`}
          to="/admin/jobs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-2">Users (last 30d)</p>
          <p className="text-xl font-semibold text-gray-900">{stats.users.last30d}</p>
          <p className="text-sm text-gray-400">{stats.users.last7d} in last 7d</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-2">Agent Reports</p>
          <p className="text-xl font-semibold text-gray-900">{stats.reports.total}</p>
          <p className="text-sm text-gray-400">{stats.reports.pending} pending</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-2">Human Reports</p>
          <p className="text-xl font-semibold text-gray-900">{stats.humanReports.total}</p>
          <p className="text-sm text-gray-400">{stats.humanReports.pending} pending</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">Agent Status</p>
          <StatusBar data={stats.agents.byStatus} colorMap={agentColors} linkPrefix="/admin/agents" />
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">Job Status</p>
          <StatusBar data={stats.jobs.byStatus} colorMap={jobColors} linkPrefix="/admin/jobs" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Listings"
          value={stats.listings.total}
          sub={`${stats.listings.open} open · ${stats.listings.applications} applications`}
          to="/admin/listings"
        />
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">Listing Status</p>
          <StatusBar data={stats.listings.byStatus} colorMap={listingColors} linkPrefix="/admin/listings" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-500 mb-2">Affiliates</p>
          <p className="text-lg font-semibold text-gray-900">
            {stats.affiliates.approved} approved <span className="text-sm font-normal text-gray-400">/ {stats.affiliates.total} total</span>
          </p>
        </div>
        <a href="/admin/feedback" className="bg-white rounded-lg shadow p-5 hover:ring-2 hover:ring-blue-200 transition-all block">
          <p className="text-sm font-medium text-gray-500 mb-2">Feedback</p>
          <p className="text-xl font-semibold text-gray-900">{stats.feedback.total}</p>
          <p className="text-sm text-gray-400">{stats.feedback.new} new</p>
        </a>
      </div>
    </div>
  );
}
