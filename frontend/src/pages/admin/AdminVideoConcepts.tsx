import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { VideoConcept, VideoConceptStatus, VideoJob } from '../../types/admin';

type ModalMode = 'create' | 'edit' | 'view' | null;

const STATUS_BADGES: Record<VideoConceptStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-700' },
  nano_done: { label: 'Nano Done', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', cls: 'bg-yellow-100 text-yellow-700' },
  draft_done: { label: 'Draft Done', cls: 'bg-green-100 text-green-700' },
  final_done: { label: 'Final Done', cls: 'bg-green-100 text-green-700' },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function JobStatusIndicator({ job, onCancel, onClick }: { job: VideoJob; onCancel: () => void; onClick?: () => void }) {
  if (job.status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 cursor-pointer" onClick={onClick}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        Queued...
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="ml-1 text-gray-400 hover:text-red-500 text-xs">&times;</button>
      </span>
    );
  }
  if (job.status === 'RUNNING') {
    const step = job.pipelineStep || 'starting';
    const pct = job.progressPct != null ? ` ${job.progressPct}%` : '';
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 cursor-pointer hover:text-blue-800" onClick={onClick}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        {step}{pct}
      </span>
    );
  }
  if (job.status === 'FAILED') {
    return (
      <span className="text-sm text-red-600 cursor-pointer hover:text-red-800" onClick={onClick} title={job.errorMessage || 'Unknown error'}>
        Failed
      </span>
    );
  }
  if (job.status === 'COMPLETED') {
    return (
      <button onClick={onClick} className="text-xs text-gray-400 hover:text-gray-600">
        Logs
      </button>
    );
  }
  return null;
}

function LogPanel({ job, onClose }: { job: VideoJob; onClose: () => void }) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job.logTail]);

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="mx-4 my-2 rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Job: <span className="text-gray-200 font-mono">{job.id.slice(0, 12)}</span></span>
              <span>Type: <span className="text-gray-200">{job.jobType}</span></span>
              <span>Tier: <span className="text-gray-200">{job.tier}</span></span>
              {job.claimedAt && <span>Started: <span className="text-gray-200">{new Date(job.claimedAt).toLocaleTimeString()}</span></span>}
              {job.completedAt && <span>Completed: <span className="text-gray-200">{new Date(job.completedAt).toLocaleTimeString()}</span></span>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">&times;</button>
          </div>

          {/* Error banner */}
          {job.status === 'FAILED' && job.errorMessage && (
            <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-red-300 text-sm">
              <strong>Error:</strong> {job.errorMessage}
            </div>
          )}

          {/* Log content */}
          <div className="max-h-64 overflow-y-auto">
            <pre className="px-4 py-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
              {job.logTail || '(no logs yet)'}
              <div ref={logEndRef} />
            </pre>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminVideoConcepts() {
  const [concepts, setConcepts] = useState<VideoConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active jobs: slug -> latest active job
  const [activeJobs, setActiveJobs] = useState<Record<string, VideoJob>>({});
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<VideoConcept | null>(null);
  const [formData, setFormData] = useState({ title: '', slug: '', duration: '30-45', style: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded log viewer
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Approve modal
  const [approveSlug, setApproveSlug] = useState<string | null>(null);
  const [approveTier, setApproveTier] = useState('draft');

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getVideoConcepts();
      setConcepts(res.concepts);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConcepts(); }, [fetchConcepts]);

  // Poll active jobs every 3s
  useEffect(() => {
    const jobIds = Object.values(activeJobs)
      .filter(j => j.status === 'PENDING' || j.status === 'RUNNING')
      .map(j => j.id);

    if (jobIds.length === 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const updates: Record<string, VideoJob> = { ...activeJobs };
      let anyCompleted = false;

      for (const jobId of jobIds) {
        try {
          const job = await api.getVideoJob(jobId);
          updates[job.conceptSlug] = job;
          if (job.status === 'COMPLETED') {
            anyCompleted = true;
          }
        } catch {
          // Job may have been deleted, remove from tracking
        }
      }

      setActiveJobs(updates);
      if (anyCompleted) {
        fetchConcepts();
      }
    };

    pollTimerRef.current = setInterval(poll, 3000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activeJobs, fetchConcepts]);

  const openCreate = () => {
    setFormData({ title: '', slug: '', duration: '30-45', style: '', body: '' });
    setAutoSlug(true);
    setSaveError('');
    setModalMode('create');
  };

  const openEdit = async (concept: VideoConcept) => {
    try {
      const full = await api.getVideoConcept(concept.slug);
      setSelected(full);
      setFormData({
        title: full.title,
        slug: full.slug,
        duration: full.duration,
        style: full.style,
        body: full.body,
      });
      setAutoSlug(false);
      setSaveError('');
      setModalMode('edit');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openView = async (concept: VideoConcept) => {
    try {
      const full = await api.getVideoConcept(concept.slug);
      setSelected(full);
      setModalMode('view');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (modalMode === 'create') {
        await api.createVideoConcept({
          title: formData.title,
          slug: formData.slug || undefined,
          duration: formData.duration || undefined,
          style: formData.style || undefined,
          body: formData.body,
        });
        toast.success('Concept created');
      } else if (modalMode === 'edit' && selected) {
        await api.updateVideoConcept(selected.slug, {
          title: formData.title,
          duration: formData.duration,
          style: formData.style,
          body: formData.body,
        });
        toast.success('Concept updated');
      }
      closeModal();
      await fetchConcepts();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    setDeleting(true);
    try {
      await api.deleteVideoConcept(slug);
      setDeleteConfirm(null);
      toast.success('Concept deleted');
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async (slug: string) => {
    try {
      const res = await api.previewVideoConcept(slug);
      toast.success(`Preview queued for '${slug}'`);
      // Track the job
      const job = await api.getVideoJob(res.jobId);
      setActiveJobs(prev => ({ ...prev, [slug]: job }));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApprove = async () => {
    if (!approveSlug) return;
    try {
      await api.approveVideoConcept(approveSlug, approveTier);
      toast.success(`Approved '${approveSlug}' for ${approveTier} tier`);
      setApproveSlug(null);
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleProduce = async (slug: string) => {
    try {
      const res = await api.produceVideoConcept(slug);
      toast.success('Production queued');
      const job = await api.getVideoJob(res.jobId);
      setActiveJobs(prev => ({ ...prev, [slug]: job }));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelJob = async (slug: string) => {
    const job = activeJobs[slug];
    if (!job) return;
    try {
      await api.cancelVideoJob(job.id);
      toast.success('Job cancelled');
      setActiveJobs(prev => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading video concepts...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Video Concepts</h2>
          <p className="text-sm text-gray-500 mt-1">{concepts.length} concept{concepts.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + New Concept
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {concepts.map((c) => {
              const badge = STATUS_BADGES[c.status] || STATUS_BADGES.new;
              const activeJob = activeJobs[c.slug];
              const hasActiveJob = activeJob && (activeJob.status === 'PENDING' || activeJob.status === 'RUNNING');
              const toggleLogs = () => setExpandedJob(prev => prev === c.slug ? null : c.slug);
              return (
                <React.Fragment key={c.slug}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{c.slug}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{c.title}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.approvedTier || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.duration || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {hasActiveJob ? (
                        <JobStatusIndicator job={activeJob} onCancel={() => handleCancelJob(c.slug)} onClick={toggleLogs} />
                      ) : (
                        <>
                          {activeJob?.status === 'FAILED' && (
                            <JobStatusIndicator job={activeJob} onCancel={() => {}} onClick={toggleLogs} />
                          )}
                          {activeJob?.status === 'COMPLETED' && (
                            <JobStatusIndicator job={activeJob} onCancel={() => {}} onClick={toggleLogs} />
                          )}
                          <button onClick={() => openView(c)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                          <button onClick={() => openEdit(c)} className="text-gray-600 hover:text-gray-800 text-sm">Edit</button>
                          {c.status === 'new' && (
                            <button onClick={() => handlePreview(c.slug)} className="text-indigo-600 hover:text-indigo-800 text-sm">Preview</button>
                          )}
                          {c.status === 'nano_done' && (
                            <button onClick={() => { setApproveSlug(c.slug); setApproveTier('draft'); }} className="text-yellow-600 hover:text-yellow-800 text-sm">Approve</button>
                          )}
                          {c.status === 'approved' && (
                            <button onClick={() => handleProduce(c.slug)} className="text-green-600 hover:text-green-800 text-sm">Produce</button>
                          )}
                          {deleteConfirm === c.slug ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(c.slug)}
                                disabled={deleting}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                {deleting ? '...' : 'Confirm'}
                              </button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirm(c.slug)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedJob === c.slug && activeJob && (
                  <LogPanel job={activeJob} onClose={() => setExpandedJob(null)} />
                )}
                </React.Fragment>
              );
            })}
            {concepts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No concepts found. Create one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {approveSlug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setApproveSlug(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Approve &ldquo;{approveSlug}&rdquo;</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Production Tier</label>
                <select
                  value={approveTier}
                  onChange={(e) => setApproveTier(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="draft">Draft (~$1)</option>
                  <option value="final">Final (~$5)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setApproveSlug(null)} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit / View Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalMode === 'create' ? 'New Concept' : modalMode === 'edit' ? `Edit: ${selected?.slug}` : selected?.title}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-4">
              {modalMode === 'view' && selected ? (
                <div>
                  <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
                    <span>Status: <strong>{STATUS_BADGES[selected.status]?.label || selected.status}</strong></span>
                    <span>Duration: <strong>{selected.duration || '—'}</strong></span>
                    <span>Style: <strong>{selected.style || '—'}</strong></span>
                    {selected.approvedTier && <span>Tier: <strong>{selected.approvedTier}</strong></span>}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm font-sans bg-gray-50 rounded-lg p-4 border max-h-96 overflow-y-auto">
                    {selected.body}
                  </pre>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(selected)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setFormData(d => ({
                          ...d,
                          title,
                          ...(autoSlug && modalMode === 'create' ? { slug: slugify(title) } : {}),
                        }));
                      }}
                      placeholder="e.g. Maya's First Day"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => {
                          setAutoSlug(false);
                          setFormData(d => ({ ...d, slug: e.target.value }));
                        }}
                        placeholder="auto-generated-from-title"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={formData.duration}
                        onChange={(e) => setFormData(d => ({ ...d, duration: e.target.value }))}
                        placeholder="30-45"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                      <input
                        type="text"
                        value={formData.style}
                        onChange={(e) => setFormData(d => ({ ...d, style: e.target.value }))}
                        placeholder="cinematic, warm lighting"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body (creative brief)</label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData(d => ({ ...d, body: e.target.value }))}
                      rows={20}
                      placeholder="Write the creative brief / concept description..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.body.length} characters</p>
                  </div>
                  {saveError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.title || !formData.body}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
