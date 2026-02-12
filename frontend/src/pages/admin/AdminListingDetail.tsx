import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface AdminListingDetail {
  id: string;
  title: string;
  description: string;
  category: string | null;
  budgetUsdc: string;
  requiredSkills: string[];
  requiredEquipment: string[];
  location: string | null;
  workMode: string | null;
  status: string;
  expiresAt: string;
  maxApplicants: number | null;
  isPro: boolean;
  createdAt: string;
  updatedAt: string;
  agent: { id: string; name: string; status: string; activationTier: string } | null;
  applications: Array<{
    id: string;
    pitch: string;
    status: string;
    createdAt: string;
    jobId: string | null;
    human: { id: string; name: string; email: string; skills: string[] };
  }>;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

const appStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  OFFERED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-600',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export default function AdminListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getAdminListing(id)
      .then(setListing)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!listing) return <p className="text-gray-500">Listing not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/listings" className="text-sm text-gray-500 hover:text-gray-700">&larr; Listings</Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{listing.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[listing.status] || 'bg-gray-100'}`}>
                {listing.status}
              </span>
              {listing.isPro && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PRO</span>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">${listing.budgetUsdc}</p>
        </div>

        <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{listing.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <p className="text-gray-500">Agent</p>
            {listing.agent ? (
              <Link to={`/admin/agents/${listing.agent.id}`} className="text-indigo-600 hover:underline">
                {listing.agent.name}
              </Link>
            ) : <p className="text-gray-400">—</p>}
          </div>
          <div>
            <p className="text-gray-500">Category</p>
            <p className="text-gray-900">{listing.category || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Work Mode</p>
            <p className="text-gray-900">{listing.workMode || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Location</p>
            <p className="text-gray-900">{listing.location || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Max Applicants</p>
            <p className="text-gray-900">{listing.maxApplicants ?? 'Unlimited'}</p>
          </div>
          <div>
            <p className="text-gray-500">Expires</p>
            <p className="text-gray-900">{new Date(listing.expiresAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="text-gray-900">{new Date(listing.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Agent Tier</p>
            <p className="text-gray-900">{listing.agent?.activationTier || '—'}</p>
          </div>
        </div>

        {listing.requiredSkills.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-1">Required Skills</p>
            <div className="flex flex-wrap gap-1">
              {listing.requiredSkills.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}

        {listing.requiredEquipment.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-gray-500 mb-1">Required Equipment</p>
            <div className="flex flex-wrap gap-1">
              {listing.requiredEquipment.map(e => (
                <span key={e} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Applications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Applications ({listing.applications.length})
        </h3>

        {listing.applications.length === 0 ? (
          <p className="text-sm text-gray-500">No applications yet</p>
        ) : (
          <div className="space-y-3">
            {listing.applications.map(app => (
              <div key={app.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/admin/users/${app.human.id}`} className="font-medium text-indigo-600 hover:underline">
                      {app.human.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{app.human.email}</p>
                    {app.human.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {app.human.skills.slice(0, 5).map(s => (
                          <span key={s} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${appStatusColors[app.status] || 'bg-gray-100'}`}>
                      {app.status}
                    </span>
                    {app.jobId && (
                      <Link to={`/admin/jobs/${app.jobId}`} className="text-xs text-indigo-600 hover:underline">
                        View Job
                      </Link>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700">{app.pitch}</p>
                <p className="mt-1 text-xs text-gray-400">{new Date(app.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
