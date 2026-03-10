import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API_BASE = '/api/concierge-postings';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ===== TYPES =====

interface ConciergePosting {
  id: string;
  jobId: string;
  title: string;
  description: string;
  externalNote?: string;
  suggestedSkills: string[];
  suggestedLocation?: string;
  suggestedEquipment: string[];
  magicToken: string;
  magicUrl: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  applicationCount: number;
  tokenExpiresAt?: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    status: string;
    agentName?: string;
  };
}

interface ExternalApplication {
  id: string;
  name: string;
  email: string;
  phone?: string;
  pitch: string;
  portfolioUrl?: string;
  status: 'NEW' | 'REVIEWED' | 'SHORTLISTED' | 'REJECTED' | 'HIRED';
  reviewNote?: string;
  createdAt: string;
  linkedHuman?: { id: string; name: string };
  subJob?: { id: string; status: string; priceUsdc: string };
}

// ===== STATUS COLORS =====

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-200 text-gray-500',
  NEW: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
  HIRED: 'bg-green-100 text-green-700',
};

// ===== MAIN COMPONENT =====

export default function ConciergePostingsSection() {
  const [postings, setPostings] = useState<ConciergePosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosting, setSelectedPosting] = useState<ConciergePosting | null>(null);
  const [applications, setApplications] = useState<ExternalApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    jobId: '',
    title: '',
    description: '',
    externalNote: '',
    suggestedSkills: '',
    suggestedLocation: '',
    suggestedEquipment: '',
  });
  const [creating, setCreating] = useState(false);

  // Hire modal state
  const [hireApp, setHireApp] = useState<ExternalApplication | null>(null);
  const [hirePrice, setHirePrice] = useState('');
  const [hiring, setHiring] = useState(false);

  const loadPostings = useCallback(async () => {
    try {
      const data = await apiFetch<{ postings: ConciergePosting[]; total: number }>('/');
      setPostings(data.postings);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load postings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPostings();
  }, [loadPostings]);

  const loadApplications = async (posting: ConciergePosting) => {
    setSelectedPosting(posting);
    setAppsLoading(true);
    try {
      const data = await apiFetch<{ applications: ExternalApplication[]; total: number }>(`/${posting.id}/applications`);
      setApplications(data.applications);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load applications');
    } finally {
      setAppsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.jobId || !createForm.title || !createForm.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const result = await apiFetch<{ id: string; magicUrl: string; magicToken: string }>('/', {
        method: 'POST',
        body: JSON.stringify({
          jobId: createForm.jobId,
          title: createForm.title,
          description: createForm.description,
          externalNote: createForm.externalNote || undefined,
          suggestedSkills: createForm.suggestedSkills ? createForm.suggestedSkills.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          suggestedLocation: createForm.suggestedLocation || undefined,
          suggestedEquipment: createForm.suggestedEquipment ? createForm.suggestedEquipment.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        }),
      });

      toast.success('Posting created! Set it to ACTIVE when ready to share.');
      setShowCreateModal(false);
      setCreateForm({ jobId: '', title: '', description: '', externalNote: '', suggestedSkills: '', suggestedLocation: '', suggestedEquipment: '' });
      await loadPostings();

      // Auto-copy magic link
      try {
        await navigator.clipboard.writeText(result.magicUrl);
        toast.success(`Magic link copied: ${result.magicUrl}`);
      } catch {
        toast(`Magic link: ${result.magicUrl}`, { duration: 8000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create posting');
    } finally {
      setCreating(false);
    }
  };

  const updatePostingStatus = async (postingId: string, status: string) => {
    try {
      await apiFetch(`/${postingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Posting ${status.toLowerCase()}`);
      await loadPostings();
      if (selectedPosting?.id === postingId) {
        setSelectedPosting(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update posting');
    }
  };

  const updateApplicationStatus = async (postingId: string, appId: string, status: string) => {
    try {
      await apiFetch(`/${postingId}/applications/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Application marked as ${status.toLowerCase()}`);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: status as any } : a));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update application');
    }
  };

  const handleHire = async () => {
    if (!hireApp || !selectedPosting || !hirePrice) return;

    const price = parseFloat(hirePrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setHiring(true);
    try {
      const result = await apiFetch<{ subJobId: string; isNewAccount: boolean }>(`/${selectedPosting.id}/applications/${hireApp.id}/hire`, {
        method: 'POST',
        body: JSON.stringify({ priceUsdc: price }),
      });

      toast.success(result.isNewAccount
        ? 'Hired! A new account has been created for the applicant.'
        : 'Hired! The applicant will receive a job offer notification.'
      );

      setHireApp(null);
      setHirePrice('');
      // Refresh applications
      await loadApplications(selectedPosting);
      await loadPostings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to hire applicant');
    } finally {
      setHiring(false);
    }
  };

  const copyLink = async (magicUrl: string) => {
    try {
      await navigator.clipboard.writeText(magicUrl);
      toast.success('Magic link copied!');
    } catch {
      toast(`Link: ${magicUrl}`, { duration: 5000 });
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>;
  }

  // ===== DETAIL VIEW =====
  if (selectedPosting) {
    return (
      <div className="space-y-4">
        {/* Back button + posting header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedPosting(null); setApplications([]); }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            &larr; Back to postings
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedPosting.title}</h2>
              <p className="text-sm text-gray-500 mt-1">Job: {selectedPosting.job.title} &middot; Agent: {selectedPosting.job.agentName || 'Unknown'}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedPosting.status]}`}>
              {selectedPosting.status}
            </span>
          </div>

          {/* Magic link */}
          <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700 font-mono flex-1 truncate">{selectedPosting.magicUrl}</span>
            <button
              onClick={() => copyLink(selectedPosting.magicUrl)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Copy
            </button>
          </div>

          {/* Status actions */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {selectedPosting.status === 'DRAFT' && (
              <button
                onClick={() => updatePostingStatus(selectedPosting.id, 'ACTIVE')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Activate (Start Accepting Applications)
              </button>
            )}
            {selectedPosting.status === 'ACTIVE' && (
              <button
                onClick={() => updatePostingStatus(selectedPosting.id, 'CLOSED')}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                Close Posting
              </button>
            )}
          </div>
        </div>

        {/* Applications list */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Applications ({applications.length})</h3>
          </div>

          {appsLoading ? (
            <div className="p-8 text-center text-gray-400 animate-pulse">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No applications yet. Share the magic link to start receiving applications.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {applications.map((app) => (
                <div key={app.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{app.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status]}`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{app.email}{app.phone ? ` · ${app.phone}` : ''}</p>
                      <p className="text-sm text-gray-700 mt-2">{app.pitch}</p>
                      {app.portfolioUrl && (
                        <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block">
                          View Portfolio &rarr;
                        </a>
                      )}
                      {app.subJob && (
                        <p className="text-sm text-green-600 mt-1">Sub-job created: ${app.subJob.priceUsdc} ({app.subJob.status})</p>
                      )}
                    </div>

                    {/* Actions */}
                    {app.status !== 'HIRED' && app.status !== 'REJECTED' && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {app.status === 'NEW' && (
                          <button
                            onClick={() => updateApplicationStatus(selectedPosting.id, app.id, 'REVIEWED')}
                            className="px-2.5 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
                          >
                            Review
                          </button>
                        )}
                        {(app.status === 'NEW' || app.status === 'REVIEWED') && (
                          <button
                            onClick={() => updateApplicationStatus(selectedPosting.id, app.id, 'SHORTLISTED')}
                            className="px-2.5 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200"
                          >
                            Shortlist
                          </button>
                        )}
                        {app.status !== 'REJECTED' && (
                          <button
                            onClick={() => updateApplicationStatus(selectedPosting.id, app.id, 'REJECTED')}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                          >
                            Reject
                          </button>
                        )}
                        {(app.status === 'REVIEWED' || app.status === 'SHORTLISTED') && (
                          <button
                            onClick={() => { setHireApp(app); setHirePrice(''); }}
                            className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            Hire
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hire modal */}
        {hireApp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hire {hireApp.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                This will create a sub-job and {hireApp.email ? `notify them at ${hireApp.email}` : 'notify the applicant'}.
                If they don't have an account, one will be created automatically.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (USDC)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={hirePrice}
                  onChange={(e) => setHirePrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="50.00"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setHireApp(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHire}
                  disabled={hiring || !hirePrice}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {hiring ? 'Creating...' : 'Confirm & Hire'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Concierge Postings</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + New Posting
        </button>
      </div>

      {postings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-600 mb-2">No concierge postings yet.</p>
          <p className="text-sm text-gray-400">
            When an agent hires you, create a posting with a magic link to share externally and find the right person for the job.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {postings.map((posting) => (
            <div
              key={posting.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => loadApplications(posting)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900">{posting.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[posting.status]}`}>
                      {posting.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Job: {posting.job.title} &middot; {posting.applicationCount} application{posting.applicationCount !== 1 ? 's' : ''}
                  </p>
                  {posting.externalNote && (
                    <p className="text-xs text-gray-400 mt-1">📌 {posting.externalNote}</p>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); copyLink(posting.magicUrl); }}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 flex-shrink-0"
                >
                  Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create External Posting</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Job ID *</label>
                <input
                  type="text"
                  value={createForm.jobId}
                  onChange={(e) => setCreateForm(f => ({ ...f, jobId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Paste the Job ID from your accepted jobs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Looking for a photographer in Chicago"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                  placeholder="Describe the task, requirements, and what you're looking for..."
                  maxLength={3000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Where are you posting this? (optional)</label>
                <input
                  type="text"
                  value={createForm.externalNote}
                  onChange={(e) => setCreateForm(f => ({ ...f, externalNote: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Chicago Photographers Facebook group"
                  maxLength={1000}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Skills</label>
                  <input
                    type="text"
                    value={createForm.suggestedSkills}
                    onChange={(e) => setCreateForm(f => ({ ...f, suggestedSkills: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="photography, editing"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated. Pre-fills applicant's profile.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={createForm.suggestedLocation}
                    onChange={(e) => setCreateForm(f => ({ ...f, suggestedLocation: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Chicago, IL"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.jobId || !createForm.title || !createForm.description}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Posting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
