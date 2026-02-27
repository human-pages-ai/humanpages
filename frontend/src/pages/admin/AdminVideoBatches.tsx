import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import type { BatchSummary, BatchDetail, BatchConceptDetail, VideoScriptData, VideoScene } from '../../types/admin';
import toast from 'react-hot-toast';

// ─── AuthImage — fetches images with JWT header ───
function AuthImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');

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
}: {
  date: string;
  conceptNum: number;
  onClose: () => void;
  onApprove: (num: number) => void;
  onReject: (num: number) => void;
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
                        <span className="text-xs font-medium text-gray-500">Dialogue</span>
                        <textarea
                          rows={2}
                          value={scene.dialogue || ''}
                          onChange={e => handleSceneEdit(scene.scene_number, 'dialogue', e.target.value || null)}
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
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500">Sound Effect</span>
                        <input
                          type="text"
                          value={scene.sound_effect || ''}
                          onChange={e => handleSceneEdit(scene.scene_number, 'sound_effect', e.target.value || null)}
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
                      {scene.sound_effect && (
                        <p className="text-xs text-gray-400">SFX: {scene.sound_effect}</p>
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

// ─── Batch List View ───
function BatchListView({ batches, onSelect }: { batches: BatchSummary[]; onSelect: (date: string) => void }) {
  if (batches.length === 0) {
    return <p className="text-gray-500 text-center py-8">No batches found.</p>;
  }

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Concepts</th>
            <th className="px-4 py-3 font-medium">Valid</th>
            <th className="px-4 py-3 font-medium">Approved</th>
            <th className="px-4 py-3 font-medium">Tier</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr
              key={b.date}
              onClick={() => onSelect(b.date)}
              className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-4 py-3 font-medium">{b.date}</td>
              <td className="px-4 py-3">{b.conceptCount}</td>
              <td className="px-4 py-3">{b.validConcepts}</td>
              <td className="px-4 py-3">
                {b.approvedCount > 0 ? (
                  <span className="text-green-700 font-medium">{b.approvedCount}</span>
                ) : (
                  <span className="text-gray-400">0</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{b.tier}</span>
              </td>
              <td className="px-4 py-3 text-right text-sm text-blue-600">View &rarr;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Batch Detail View ───
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
          <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; All Batches</button>
          <h2 className="text-lg font-semibold">Batch: {date}</h2>
          <span className="text-sm text-gray-500">{batch.conceptCount} concepts</span>
        </div>
        <button onClick={toggleAll} className="text-sm text-gray-600 hover:text-gray-800">
          {selected.size === batch.concepts.filter(c => !c.failed).length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Concept grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batch.concepts.map(c => (
          <div
            key={c.number}
            className={`bg-white rounded-lg border overflow-hidden transition-shadow hover:shadow-md ${
              c.failed ? 'opacity-50' : 'cursor-pointer'
            } ${selected.has(c.number) ? 'ring-2 ring-blue-500' : ''}`}
          >
            {/* Thumbnail */}
            <div
              className="relative h-48 bg-gray-100"
              onClick={() => !c.failed && setModalConcept(c.number)}
            >
              {c.hasThumbnails ? (
                <AuthImage
                  src={api.getVideoBatchImageUrl(date, c.number, 'scene_01.png')}
                  alt={c.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 flex items-center justify-center text-gray-400 text-sm">
                  {c.failed ? 'FAILED' : 'No thumbnail'}
                </div>
              )}
              {/* Approval badge */}
              {c.approved && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  Approved
                </div>
              )}
              {/* Concept number */}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                #{c.number}
              </div>
            </div>

            {/* Card body */}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-sm font-semibold truncate cursor-pointer hover:text-blue-600"
                    onClick={() => !c.failed && setModalConcept(c.number)}
                  >
                    {c.title}
                  </h3>
                  {c.hook && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">&ldquo;{c.hook}&rdquo;</p>
                  )}
                </div>
                {!c.failed && (
                  <input
                    type="checkbox"
                    checked={selected.has(c.number)}
                    onChange={() => toggleSelect(c.number)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded flex-shrink-0"
                  />
                )}
              </div>
              {c.pillar && (
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${getPillarColor(c.pillar)}`}>
                  {c.pillar}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg px-6 py-3 flex items-center justify-between z-40">
          <span className="text-sm text-gray-600">{selected.size} concept(s) selected</span>
          <div className="flex items-center gap-3">
            <select
              value={tier}
              onChange={e => setTier(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5"
            >
              <option value="nano">nano</option>
              <option value="draft">draft</option>
              <option value="final">final</option>
            </select>
            <button
              onClick={() => handleApprove()}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading ? 'Working...' : `Approve Selected (${selected.size})`}
            </button>
            <button
              onClick={() => handleReject()}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
            >
              Reject Selected
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
        />
      )}
    </div>
  );
}

// ─── Batches Tab (reusable) ───
export function BatchesTab() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    api.getVideoBatches()
      .then(data => setBatches(data.batches))
      .catch(() => toast.error('Failed to load batches'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading batches...</p>;
  }

  if (selectedDate) {
    return (
      <BatchDetailView
        date={selectedDate}
        onBack={() => setSelectedDate(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Video Batches</h1>
        <span className="text-sm text-gray-500">{batches.length} batch(es)</span>
      </div>
      <BatchListView batches={batches} onSelect={setSelectedDate} />
    </div>
  );
}
