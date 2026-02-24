import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { VideoConcept, VideoConceptStatus, VideoJob, VideoJobStatus, VideoItem, VideoDetail, VideoTier, VideoStatusType } from '../../types/admin';
import StoryboardViewer from './video/StoryboardViewer';

type ModalMode = 'create' | 'edit' | 'view' | null;

const STATUS_BADGES: Record<VideoConceptStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-700' },
  nano_done: { label: 'Nano Done', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', cls: 'bg-yellow-100 text-yellow-700' },
  draft_done: { label: 'Draft Done', cls: 'bg-green-100 text-green-700' },
  final_done: { label: 'Final Done', cls: 'bg-green-100 text-green-700' },
};

const JOB_STATUS_COLORS: Record<VideoJobStatus, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  RUNNING: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function StatusBadge({ status }: { status: VideoJobStatus }) {
  const colors = JOB_STATUS_COLORS[status] || JOB_STATUS_COLORS.PENDING;
  const isActive = status === 'RUNNING' || status === 'PENDING';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {isActive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${colors.dot}`} />
        </span>
      )}
      {status}
    </span>
  );
}

function StepDots({ parentJob }: { parentJob: VideoJob }) {
  const steps = parentJob.stepJobs || [];
  const tier = parentJob.tier;
  const totalSteps = tier === 'nano' ? 2 : 5;
  const stepNames = ['script', 'images', 'animate', 'voiceover', 'compose'];

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const step = steps.find(s => s.stepNumber === stepNum);
        let color = 'bg-gray-300'; // not started
        let title = `Step ${stepNum}: ${stepNames[i]} (pending)`;
        if (step) {
          if (step.status === 'COMPLETED') { color = 'bg-green-500'; title = `Step ${stepNum}: ${stepNames[i]} (done)`; }
          else if (step.status === 'RUNNING') { color = 'bg-blue-500'; title = `Step ${stepNum}: ${stepNames[i]} (running)`; }
          else if (step.status === 'FAILED') { color = 'bg-red-500'; title = `Step ${stepNum}: ${stepNames[i]} (failed)`; }
          else if (step.status === 'CANCELLED') { color = 'bg-gray-400'; title = `Step ${stepNum}: ${stepNames[i]} (cancelled)`; }
          else if (step.status === 'PENDING') { color = 'bg-amber-400'; title = `Step ${stepNum}: ${stepNames[i]} (queued)`; }
        }
        return <span key={stepNum} className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} title={title} />;
      })}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Job Queue Table ────────────────────────────────────

function JobQueueTable() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [logJobId, setLogJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [fetchError, setFetchError] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.getVideoJobs();
      setJobs(res.jobs);
      setFetchError('');
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh every 5s if any active jobs
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'RUNNING' || j.status === 'PENDING');
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs, fetchJobs]);

  const handleCancel = async (jobId: string) => {
    try {
      await api.cancelVideoJob(jobId);
      toast.success('Job cancelled');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="mb-6 text-sm text-gray-400">Loading job queue...</div>;
  if (fetchError) return <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Job queue error: {fetchError}</div>;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Queue</h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concept</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Steps</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 text-sm">No jobs in queue. Preview or produce a concept to see jobs here.</td></tr>
            )}
            {jobs.map(job => {
              const isExpanded = expandedJobId === job.id;
              const steps = job.stepJobs || [];
              return (
                <React.Fragment key={job.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  >
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {steps.length > 0 ? (isExpanded ? '▼' : '▶') : ''}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-700">{job.conceptSlug}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{job.jobType}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{job.tier}</td>
                    <td className="px-4 py-2"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              job.status === 'FAILED' ? 'bg-red-500' :
                              job.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${job.progressPct || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{job.progressPct || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2"><StepDots parentJob={job} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500">{timeAgo(job.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {(job.status === 'RUNNING' || job.status === 'PENDING') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(job.id); }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && steps.map(step => (
                    <React.Fragment key={step.id}>
                      <tr
                        className="bg-gray-50/50 hover:bg-gray-100/50 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setLogJobId(logJobId === step.id ? null : step.id); }}
                      >
                        <td className="px-4 py-1.5"></td>
                        <td className="px-4 py-1.5 text-xs text-gray-500 pl-8">
                          Step {step.stepNumber}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-gray-600">{step.stepName}</td>
                        <td className="px-4 py-1.5"></td>
                        <td className="px-4 py-1.5"><StatusBadge status={step.status} /></td>
                        <td className="px-4 py-1.5 text-xs text-gray-500">
                          {step.status === 'FAILED' && step.errorMessage && (
                            <span className="text-red-600" title={step.errorMessage}>
                              {step.errorMessage.slice(0, 50)}{step.errorMessage.length > 50 ? '...' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-gray-400">
                          {step.completedAt ? timeAgo(step.completedAt) : ''}
                        </td>
                        <td className="px-4 py-1.5"></td>
                        <td className="px-4 py-1.5 text-right text-xs text-gray-400">
                          {(step.logTail || step.status === 'RUNNING') ? (logJobId === step.id ? 'hide logs' : 'logs') : ''}
                        </td>
                      </tr>
                      {logJobId === step.id && (
                        <StepLogPanel job={step} onClose={() => setLogJobId(null)} />
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepLogPanel({ job, onClose }: { job: VideoJob; onClose: () => void }) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job.logTail]);

  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="mx-8 my-2 rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Step {job.stepNumber}: <span className="text-gray-200">{job.stepName}</span></span>
              {job.claimedAt && <span>Started: <span className="text-gray-200">{new Date(job.claimedAt).toLocaleTimeString()}</span></span>}
              {job.completedAt && <span>Completed: <span className="text-gray-200">{new Date(job.completedAt).toLocaleTimeString()}</span></span>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2">&times;</button>
          </div>
          {job.status === 'FAILED' && job.errorMessage && (
            <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-red-300 text-sm">
              <strong>Error:</strong> {job.errorMessage}
            </div>
          )}
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

// ── Per-concept job indicator (existing) ──────────────────

function JobStatusIndicator({ job, onCancel, onClick }: { job: VideoJob; onCancel: () => void; onClick?: () => void }) {
  if (job.status === 'PENDING' || job.status === 'RUNNING') {
    const step = job.pipelineStep || 'starting';
    const pct = job.progressPct != null ? ` ${job.progressPct}%` : '';
    const isQueued = job.status === 'PENDING';
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm ${isQueued ? 'text-amber-600' : 'text-blue-600'} cursor-pointer hover:opacity-80`} onClick={onClick}>
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isQueued ? 'bg-amber-400' : 'bg-blue-400'} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isQueued ? 'bg-amber-500' : 'bg-blue-500'}`} />
        </span>
        {isQueued ? 'Queued...' : `${step}${pct}`}
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="ml-1 text-gray-400 hover:text-red-500 text-xs">&times;</button>
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
          {job.status === 'FAILED' && job.errorMessage && (
            <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-red-300 text-sm">
              <strong>Error:</strong> {job.errorMessage}
            </div>
          )}
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

// ── Videos Tab (absorbed from AdminVideos) ────────────────

const VIDEO_TIER_COLORS: Record<VideoTier, string> = {
  NANO: 'bg-gray-100 text-gray-700',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  FINAL: 'bg-green-100 text-green-800',
};

const VIDEO_STATUS_COLORS: Record<VideoStatusType, string> = {
  GENERATING: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-green-100 text-green-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

function VideoBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function VideoDetailModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getVideo(videoId).then(setVideo).catch(console.error).finally(() => setLoading(false));
  }, [videoId]);

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return shell(<p className="text-gray-500">Loading...</p>);
  if (!video) return shell(<p className="text-red-500">Video not found</p>);

  const concept = video.conceptSnapshot as Record<string, string> || {};
  const script = video.scriptSnapshot as Record<string, unknown> | null;
  const scenes = (Array.isArray(script?.scenes) ? script.scenes : []) as Array<Record<string, unknown>>;

  return shell(
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{video.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{video.slug}</p>
        </div>
        <div className="flex gap-2">
          <VideoBadge label={video.tier} className={VIDEO_TIER_COLORS[video.tier]} />
          <VideoBadge label={video.status} className={VIDEO_STATUS_COLORS[video.status]} />
        </div>
      </div>
      {video.videoUrl && (
        <div className="rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-96 mx-auto">
          <video src={video.videoUrl} controls className="w-full h-full object-contain" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Duration:</span> {video.durationSeconds ? `${video.durationSeconds}s` : 'N/A'}</div>
        <div><span className="text-gray-500">Aspect Ratio:</span> {video.aspectRatio}</div>
        <div><span className="text-gray-500">Est. Cost:</span> {video.estimatedCostUsd ? `$${video.estimatedCostUsd.toFixed(2)}` : 'N/A'}</div>
        <div><span className="text-gray-500">Assets:</span> {video.assets.length}</div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Concept Snapshot</h3>
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          {concept.title && <p><span className="font-medium">Title:</span> {String(concept.title)}</p>}
          {concept.body && <p className="text-gray-600 whitespace-pre-wrap">{String(concept.body).slice(0, 500)}{String(concept.body).length > 500 ? '...' : ''}</p>}
        </div>
      </div>
      {scenes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Script ({scenes.length} scenes)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scenes.map((scene, i) => (
              <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Scene {(scene.scene_number as number) || i + 1}</span>
                  <span className="text-gray-500">{scene.duration_seconds as number}s &middot; {scene.shot_type as string}</span>
                </div>
                {scene.setting ? <p className="text-gray-600 mt-1">{String(scene.setting)}</p> : null}
                {scene.dialogue ? <p className="text-gray-700 mt-1 italic">&ldquo;{String(scene.dialogue)}&rdquo;</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}
      {video.assets.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Assets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {video.assets.map((a) => (
              <div key={a.id} className="bg-gray-50 rounded p-2 text-xs">
                <p className="font-medium truncate">{a.filename}</p>
                <p className="text-gray-500">{a.assetType}{a.sceneNumber != null ? ` (scene ${a.sceneNumber})` : ''}</p>
                {a.fileSize && <p className="text-gray-400">{(a.fileSize / 1024).toFixed(0)} KB</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideosTab() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    api.getVideos({
      page,
      status: statusFilter || undefined,
      tier: tierFilter || undefined,
    })
      .then((res) => {
        setVideos(res.videos);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, statusFilter, tierFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: VideoStatusType) => {
    try {
      await api.updateVideo(id, { status });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          {(['GENERATING', 'DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Tiers</option>
          {(['NANO', 'DRAFT', 'FINAL'] as const).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : videos.length === 0 ? (
        <p className="text-gray-500 text-sm">No videos found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Video</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Assets</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {videos.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedId(v.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt="" className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">N/A</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-xs">{v.title}</p>
                        <p className="text-gray-500 text-xs">{v.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><VideoBadge label={v.tier} className={VIDEO_TIER_COLORS[v.tier]} /></td>
                  <td className="px-4 py-3"><VideoBadge label={v.status} className={VIDEO_STATUS_COLORS[v.status]} /></td>
                  <td className="px-4 py-3 text-gray-600">{v.durationSeconds ? `${v.durationSeconds}s` : '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{v._count.assets}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      value=""
                      onChange={(e) => handleStatusChange(v.id, e.target.value as VideoStatusType)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="" disabled>Set status...</option>
                      <option value="READY">Ready</option>
                      <option value="ARCHIVED">Archive</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedId && <VideoDetailModal videoId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

type TabId = 'pipeline' | 'videos';

export default function AdminVideoConcepts() {
  const [tab, setTab] = useState<TabId>('pipeline');
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

  // Storyboard review
  const [reviewSlug, setReviewSlug] = useState<string | null>(null);

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

  const handleStoryboardApprove = async (slug: string, tier: string) => {
    await api.approveVideoConcept(slug, tier);
    const res = await api.produceVideoConcept(slug);
    const job = await api.getVideoJob(res.jobId);
    setActiveJobs(prev => ({ ...prev, [slug]: job }));
    await fetchConcepts();
  };

  const handleStoryboardReject = async (slug: string) => {
    await api.rejectVideoConcept(slug);
    await fetchConcepts();
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

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {([['pipeline', 'Pipeline'], ['videos', 'Videos']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Videos tab */}
      {tab === 'videos' && <VideosTab />}

      {/* Pipeline tab */}
      {tab === 'pipeline' && (
        <>
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

          {loading && (
            <div className="text-center py-12 text-gray-500">Loading video concepts...</div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {!loading && (
            <>
              {/* Job Queue Table */}
              <JobQueueTable />

              {/* Concepts Table */}
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
                                    <button onClick={() => setReviewSlug(c.slug)} className="text-yellow-600 hover:text-yellow-800 text-sm font-medium">Review</button>
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
            </>
          )}
        </>
      )}

      {/* Storyboard Viewer */}
      {reviewSlug && (
        <StoryboardViewer
          slug={reviewSlug}
          tier="nano"
          onClose={() => setReviewSlug(null)}
          onApprove={handleStoryboardApprove}
          onReject={handleStoryboardReject}
        />
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
