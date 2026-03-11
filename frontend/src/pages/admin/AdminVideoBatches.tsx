import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import type { BatchSummary, BatchDetail, BatchConceptDetail, GalleryConcept, VideoScriptData, VideoScene } from '../../types/admin';
import toast from 'react-hot-toast';
import { safeLocalStorage } from '../../lib/safeStorage';

// ─── AuthImage — fetches images with JWT header ───
function AuthImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = safeLocalStorage.getItem('token');

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load image');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [src]);

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center text-gray-400 text-xs ${className || ''}`}>
        No image
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={`bg-gray-100 animate-pulse flex items-center justify-center text-gray-300 text-xs ${className || ''}`}>
        Loading...
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}

// ─── Pillar badge colors ───
const PILLAR_COLORS: Record<string, string> = {
  'My Boss Is a Robot': 'bg-purple-100 text-purple-800',
  'Gig Economy Empowerment': 'bg-green-100 text-green-800',
  'Product Demo': 'bg-blue-100 text-blue-800',
  'Build in Public': 'bg-orange-100 text-orange-800',
  'Crypto Made Simple': 'bg-yellow-100 text-yellow-800',
  'Trust & Safety': 'bg-red-100 text-red-800',
  'AI + Human Future': 'bg-cyan-100 text-cyan-800',
  'Worker Spotlight': 'bg-pink-100 text-pink-800',
  'Myth Busting': 'bg-indigo-100 text-indigo-800',
  'Comparisons': 'bg-lime-100 text-lime-800',
  'Hot Takes': 'bg-rose-100 text-rose-800',
  "Founder's POV": 'bg-amber-100 text-amber-800',
};

function getPillarColor(pillar: string): string {
  return PILLAR_COLORS[pillar] || 'bg-gray-100 text-gray-800';
}

// ─── Concept Detail Modal with inline editing ───
function ConceptModal({
  date,
  conceptNum,
  onClose,
  onApprove,
  onReject,
  onPromoteDraft,
}: {
  date: string;
  conceptNum: number;
  onClose: () => void;
  onApprove: (num: number) => void;
  onReject: (num: number) => void;
  onPromoteDraft: (date: string, num: number) => void;
}) {
  const [detail, setDetail] = useState<BatchConceptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState<VideoScriptData | null>(null);
  const [savingScript, setSavingScript] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getVideoBatchConcept(date, conceptNum)
      .then(setDetail)
      .catch(() => toast.error('Failed to load concept'))
      .finally(() => setLoading(false));
  }, [date, conceptNum]);

  const startEditing = () => {
    if (!detail?.script) return;
    setEditedScript(JSON.parse(JSON.stringify(detail.script)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedScript(null);
  };

  const handleSceneEdit = (sceneNum: number, field: keyof VideoScene, value: string | number | null) => {
    if (!editedScript) return;
    setEditedScript(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map(s =>
          s.scene_number === sceneNum ? { ...s, [field]: value } : s
        ),
      };
    });
  };

  const saveScript = async () => {
    if (!editedScript || !detail) return;
    setSavingScript(true);
    try {
      await api.updateVideoBatchScript(date, detail.number, editedScript);
      setDetail({ ...detail, script: editedScript });
      setIsEditing(false);
      setEditedScript(null);
      toast.success('Script saved');
    } catch {
      toast.error('Failed to save script');
    } finally {
      setSavingScript(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg p-8" onClick={e => e.stopPropagation()}>
          Loading...
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const displayScript = isEditing ? editedScript : detail.script;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold">{detail.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{detail.concept}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">{date}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPillarColor(detail.pillar)}`}>
                {detail.pillar}
              </span>
              {detail.approved && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                  Approved ({detail.approvedTier})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {detail.script && !isEditing && (
              <button
                onClick={startEditing}
                className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                Edit Script
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={saveScript}
                  disabled={savingScript}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingScript ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Hook */}
        {detail.hook && (
          <div className="px-6 py-3 bg-amber-50 border-b">
            <p className="text-sm font-medium text-amber-800">Hook: &ldquo;{detail.hook}&rdquo;</p>
          </div>
        )}

        {/* Script Info */}
        {displayScript && (
          <div className="px-6 py-3 border-b bg-gray-50">
            <div className="flex gap-4 text-sm text-gray-600">
              <span>Duration: {displayScript.total_duration_seconds}s</span>
              <span>Scenes: {displayScript.scenes.length}</span>
              <span>Style: {displayScript.visual_style?.slice(0, 60)}...</span>
            </div>
          </div>
        )}

        {/* Scene-by-scene storyboard */}
        <div className="px-6 py-4 space-y-4">
          {displayScript?.scenes.map((scene) => {
            const imageFile = detail.images.find(f => f.includes(`scene_${String(scene.scene_number).padStart(2, '0')}`));
            return (
              <div key={scene.scene_number} className="flex gap-4 border rounded-lg p-3">
                {/* Scene image */}
                <div className="flex-shrink-0 w-36">
                  {imageFile ? (
                    <AuthImage
                      src={api.getVideoBatchImageUrl(date, detail.number, imageFile)}
                      alt={`Scene ${scene.scene_number}`}
                      className="w-36 h-64 object-cover rounded bg-gray-100"
                    />
                  ) : (
                    <div className="w-36 h-64 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Scene details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold">Scene {scene.scene_number}</span>
                    <span className="text-xs text-gray-500">{scene.duration_seconds}s</span>
                    <span className="text-xs text-gray-400">{scene.shot_type} / {scene.camera_motion}</span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Setting</span>
                        <input
                          type="text"
                          value={scene.setting}
                          onChange={e => handleSceneEdit(scene.scene_number, 'setting', e.target.value)}
                          className="mt-0.5 block w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Image Prompt</span>
                        <textarea
                          rows={3}
                          value={scene.image_prompt}
                          onChange={e => handleSceneEdit(scene.scene_number, 'image_prompt', e.target.value)}
                          className="mt-0.5 block w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Motion Prompt</span>
                        <textarea
                          rows={2}
                          value={scene.motion_prompt}
                          onChange={e => handleSceneEdit(scene.scene_number, 'motion_prompt', e.target.value)}
                          className="mt-0.5 block w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Narration</span>
                        <textarea
                          rows={2}
                          value={scene.narration || ''}
                          onChange={e => handleSceneEdit(scene.scene_number, 'narration', e.target.value || null)}
                          className="mt-0.5 block w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Overlay Text</span>
                        <input
                          type="text"
                          value={scene.overlay_text || ''}
                          onChange={e => handleSceneEdit(scene.scene_number, 'overlay_text', e.target.value || null)}
                          className="mt-0.5 block w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 mb-1">{scene.setting}</p>
                      {scene.overlay_text && (
                        <p className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded mb-1">
                          &ldquo;{scene.overlay_text}&rdquo;
                        </p>
                      )}
                      {scene.dialogue && (
                        <p className="text-xs text-gray-500 italic mb-1">
                          {(scene as unknown as Record<string, unknown>).dialogue_speaker as string || 'Character'}: &ldquo;{scene.dialogue}&rdquo;
                        </p>
                      )}
                      {scene.narration && (
                        <p className="text-xs text-gray-500 mb-1">Narration: {scene.narration}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex gap-3 justify-end">
          {!detail.approved && (
            <button
              onClick={() => onPromoteDraft(date, detail.number)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Make Draft
            </button>
          )}
          {detail.approved ? (
            <button
              onClick={() => onReject(detail.number)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
            >
              Remove Approval
            </button>
          ) : (
            <button
              onClick={() => onApprove(detail.number)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Approve
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gallery View — flat grid of all concepts across batches ───
function GalleryView() {
  const [concepts, setConcepts] = useState<GalleryConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unapproved' | 'approved'>('all');
  const [pillarFilter, setPillarFilter] = useState<string>('');
  const [modalConcept, setModalConcept] = useState<{ date: string; num: number } | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const loadGallery = useCallback(() => {
    setLoading(true);
    api.getVideoBatchGallery()
      .then(data => setConcepts(data.concepts))
      .catch(() => toast.error('Failed to load gallery'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  const pillars = [...new Set(concepts.map(c => c.pillar).filter(Boolean))].sort();

  const filtered = concepts.filter(c => {
    if (c.failed) return false;
    if (filter === 'approved' && !c.approved) return false;
    if (filter === 'unapproved' && c.approved) return false;
    if (pillarFilter && c.pillar !== pillarFilter) return false;
    return true;
  });

  const handlePromoteDraft = async (date: string, num: number) => {
    const key = `${date}-${num}`;
    setPromotingId(key);
    try {
      await api.promoteToDraft(date, num);
      toast.success('Promoted to draft — queued for production');
      loadGallery();
      setModalConcept(null);
    } catch {
      toast.error('Failed to promote');
    } finally {
      setPromotingId(null);
    }
  };

  const handleApprove = async (date: string, nums: number[]) => {
    try {
      await api.approveVideoBatchConcepts(date, nums, 'draft');
      toast.success('Approved');
      loadGallery();
      setModalConcept(null);
    } catch {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (date: string, nums: number[]) => {
    try {
      await api.rejectVideoBatchConcepts(date, nums);
      toast.success('Rejected');
      loadGallery();
      setModalConcept(null);
    } catch {
      toast.error('Failed to reject');
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading gallery...</p>;
  }

  return (
    <div>
      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Video Gallery</h1>
          <p className="text-sm text-gray-500">{filtered.length} concepts</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {(['all', 'unapproved', 'approved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {f === 'all' ? 'All' : f === 'unapproved' ? 'New' : 'Approved'}
              </button>
            ))}
          </div>
          {/* Pillar filter */}
          <select
            value={pillarFilter}
            onChange={e => setPillarFilter(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5"
          >
            <option value="">All Pillars</option>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Gallery grid */}
      {filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No concepts match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(c => {
            const key = `${c.date}-${c.number}`;
            const isPromoting = promotingId === key;
            return (
              <div
                key={key}
                className="group relative bg-white rounded-lg border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                onClick={() => setModalConcept({ date: c.date, num: c.number })}
              >
                {/* Thumbnail — 9:16 aspect ratio */}
                <div className="relative aspect-[9/16] bg-gray-100">
                  {c.hasThumbnails ? (
                    <AuthImage
                      src={api.getVideoBatchImageUrl(c.date, c.number, 'scene_01.png')}
                      alt={c.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No thumbnail
                    </div>
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {c.date.slice(5)}
                    </span>
                    {c.approved && (
                      <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {c.approvedTier || 'approved'}
                      </span>
                    )}
                  </div>

                  {/* Quick action: Make Draft button (shows on hover) */}
                  {!c.approved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePromoteDraft(c.date, c.number);
                      }}
                      disabled={isPromoting}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isPromoting ? '...' : 'Make Draft'}
                    </button>
                  )}

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
                    <p className="text-white text-xs font-medium leading-tight line-clamp-2">{c.title}</p>
                    {c.hook && (
                      <p className="text-white/70 text-[10px] leading-tight mt-0.5 line-clamp-1">{c.hook}</p>
                    )}
                  </div>
                </div>

                {/* Pillar tag */}
                {c.pillar && (
                  <div className="px-2 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getPillarColor(c.pillar)}`}>
                      {c.pillar}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Concept detail modal */}
      {modalConcept && (
        <ConceptModal
          date={modalConcept.date}
          conceptNum={modalConcept.num}
          onClose={() => setModalConcept(null)}
          onApprove={(num) => handleApprove(modalConcept.date, [num])}
          onReject={(num) => handleReject(modalConcept.date, [num])}
          onPromoteDraft={handlePromoteDraft}
        />
      )}
    </div>
  );
}

// ─── Batch Detail View (kept for deep-dive into a specific batch) ───
function BatchDetailView({
  date,
  onBack,
}: {
  date: string;
  onBack: () => void;
}) {
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tier, setTier] = useState('draft');
  const [modalConcept, setModalConcept] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadBatch = useCallback(() => {
    setLoading(true);
    api.getVideoBatch(date)
      .then(data => {
        setBatch(data);
        setSelected(new Set());
      })
      .catch(() => toast.error('Failed to load batch'))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  const toggleSelect = (num: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const toggleAll = () => {
    if (!batch) return;
    const validNums = batch.concepts.filter(c => !c.failed).map(c => c.number);
    if (selected.size === validNums.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(validNums));
    }
  };

  const handleApprove = async (nums?: number[]) => {
    const toApprove = nums || Array.from(selected);
    if (toApprove.length === 0) return;
    setActionLoading(true);
    try {
      await api.approveVideoBatchConcepts(date, toApprove, tier);
      toast.success(`Approved ${toApprove.length} concept(s)`);
      loadBatch();
      setModalConcept(null);
    } catch {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (nums?: number[]) => {
    const toReject = nums || Array.from(selected);
    if (toReject.length === 0) return;
    setActionLoading(true);
    try {
      await api.rejectVideoBatchConcepts(date, toReject);
      toast.success(`Rejected ${toReject.length} concept(s)`);
      loadBatch();
      setModalConcept(null);
    } catch {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteDraft = async (d: string, num: number) => {
    try {
      await api.promoteToDraft(d, num);
      toast.success('Promoted to draft');
      loadBatch();
      setModalConcept(null);
    } catch {
      toast.error('Failed to promote');
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading batch...</p>;
  }

  if (!batch) {
    return <p className="text-red-500 text-center py-8">Batch not found.</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; Gallery</button>
          <h2 className="text-lg font-semibold">Batch: {date}</h2>
          <span className="text-sm text-gray-500">{batch.conceptCount} concepts</span>
        </div>
        <button onClick={toggleAll} className="text-sm text-gray-600 hover:text-gray-800">
          {selected.size === batch.concepts.filter(c => !c.failed).length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Concept grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {batch.concepts.map(c => (
          <div
            key={c.number}
            className={`bg-white rounded-lg border overflow-hidden transition-shadow hover:shadow-md ${
              c.failed ? 'opacity-50' : 'cursor-pointer'
            } ${selected.has(c.number) ? 'ring-2 ring-blue-500' : ''}`}
          >
            {/* Thumbnail */}
            <div
              className="relative aspect-[9/16] bg-gray-100"
              onClick={() => !c.failed && setModalConcept(c.number)}
            >
              {c.hasThumbnails ? (
                <AuthImage
                  src={api.getVideoBatchImageUrl(date, c.number, 'scene_01.png')}
                  alt={c.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  {c.failed ? 'FAILED' : 'No thumbnail'}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {c.approved && (
                <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                  {c.approvedTier || 'approved'}
                </div>
              )}
              <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                #{c.number}
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
                <p className="text-white text-xs font-medium leading-tight line-clamp-2">{c.title}</p>
              </div>
            </div>

            {/* Card footer */}
            <div className="p-2 flex items-center justify-between">
              {c.pillar ? (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getPillarColor(c.pillar)}`}>
                  {c.pillar}
                </span>
              ) : <span />}
              {!c.failed && (
                <input
                  type="checkbox"
                  checked={selected.has(c.number)}
                  onChange={() => toggleSelect(c.number)}
                  className="h-3.5 w-3.5 text-blue-600 rounded flex-shrink-0"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg px-6 py-3 flex items-center justify-between z-40">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <div className="flex items-center gap-3">
            <select
              value={tier}
              onChange={e => setTier(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5"
            >
              <option value="draft">draft</option>
              <option value="final">final</option>
            </select>
            <button
              onClick={() => handleApprove()}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading ? 'Working...' : `Approve (${selected.size})`}
            </button>
            <button
              onClick={() => handleReject()}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Concept detail modal */}
      {modalConcept !== null && (
        <ConceptModal
          date={date}
          conceptNum={modalConcept}
          onClose={() => setModalConcept(null)}
          onApprove={(num) => handleApprove([num])}
          onReject={(num) => handleReject([num])}
          onPromoteDraft={handlePromoteDraft}
        />
      )}
    </div>
  );
}

// ─── Batches Tab (main export) ───
export function BatchesTab() {
  const [view, setView] = useState<'gallery' | 'batch'>('gallery');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);

  useEffect(() => {
    api.getVideoBatches()
      .then(data => setBatches(data.batches))
      .catch(() => {});
  }, []);

  if (view === 'batch' && selectedDate) {
    return (
      <BatchDetailView
        date={selectedDate}
        onBack={() => { setView('gallery'); setSelectedDate(null); }}
      />
    );
  }

  return (
    <div>
      {/* Batch date chips for quick access */}
      {batches.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <span className="text-xs text-gray-400 flex-shrink-0">Batches:</span>
          {batches.slice(0, 7).map(b => (
            <button
              key={b.date}
              onClick={() => { setSelectedDate(b.date); setView('batch'); }}
              className="text-xs px-2.5 py-1 rounded-full border hover:bg-gray-50 flex-shrink-0 whitespace-nowrap"
            >
              {b.date.slice(5)} ({b.conceptCount})
            </button>
          ))}
        </div>
      )}
      <GalleryView />
    </div>
  );
}
