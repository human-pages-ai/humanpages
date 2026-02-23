import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { VideoItem, VideoDetail, VideoTier, VideoStatusType } from '../../types/admin';

const TIER_COLORS: Record<VideoTier, string> = {
  NANO: 'bg-gray-100 text-gray-700',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  FINAL: 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<VideoStatusType, string> = {
  GENERATING: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-green-100 text-green-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

function Badge({ label, className }: { label: string; className: string }) {
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

  if (loading) return <ModalShell onClose={onClose}><p className="text-gray-500">Loading...</p></ModalShell>;
  if (!video) return <ModalShell onClose={onClose}><p className="text-red-500">Video not found</p></ModalShell>;

  const concept = video.conceptSnapshot as Record<string, string> || {};
  const script = video.scriptSnapshot as Record<string, unknown> | null;
  const scenes = (Array.isArray(script?.scenes) ? script.scenes : []) as Array<Record<string, unknown>>;

  return (
    <ModalShell onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{video.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{video.slug}</p>
          </div>
          <div className="flex gap-2">
            <Badge label={video.tier} className={TIER_COLORS[video.tier]} />
            <Badge label={video.status} className={STATUS_COLORS[video.status]} />
          </div>
        </div>

        {/* Video player */}
        {video.videoUrl && (
          <div className="rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-96 mx-auto">
            <video src={video.videoUrl} controls className="w-full h-full object-contain" />
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Duration:</span> {video.durationSeconds ? `${video.durationSeconds}s` : 'N/A'}</div>
          <div><span className="text-gray-500">Aspect Ratio:</span> {video.aspectRatio}</div>
          <div><span className="text-gray-500">Est. Cost:</span> {video.estimatedCostUsd ? `$${video.estimatedCostUsd.toFixed(2)}` : 'N/A'}</div>
          <div><span className="text-gray-500">Assets:</span> {video.assets.length}</div>
        </div>

        {/* Concept Snapshot */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Concept Snapshot</h3>
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
            {concept.title && <p><span className="font-medium">Title:</span> {String(concept.title)}</p>}
            {concept.body && <p className="text-gray-600 whitespace-pre-wrap">{String(concept.body).slice(0, 500)}{String(concept.body).length > 500 ? '...' : ''}</p>}
          </div>
        </div>

        {/* Script Scenes */}
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
                  {scene.dialogue ? <p className="text-gray-700 mt-1 italic">"{String(scene.dialogue)}"</p> : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assets */}
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
    </ModalShell>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminVideos() {
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Videos</h2>
      </div>

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
                        <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-xs">{v.title}</p>
                        <p className="text-gray-500 text-xs">{v.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge label={v.tier} className={TIER_COLORS[v.tier]} /></td>
                  <td className="px-4 py-3"><Badge label={v.status} className={STATUS_COLORS[v.status]} /></td>
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
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm rounded border disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedId && <VideoDetailModal videoId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
