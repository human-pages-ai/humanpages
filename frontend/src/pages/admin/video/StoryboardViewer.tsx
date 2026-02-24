import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import type { VideoScriptData, VideoScene } from '../../../types/admin';

// ── AuthImage: fetches image with Bearer token ──────────────
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

// ── Scene Card ──────────────────────────────────────────────
interface SceneCardProps {
  scene: VideoScene;
  slug: string;
  tier: string;
  cacheKey: number;
  isCheckpoint: boolean;
  isEditing: boolean;
  editedScene?: VideoScene;
  onSceneEdit?: (sceneNum: number, field: string, value: string) => void;
  onRegenerate?: (sceneNum: number) => void;
  regenerating?: boolean;
}

function SceneCard({ scene, slug, tier, cacheKey, isCheckpoint, isEditing, editedScene, onSceneEdit, onRegenerate, regenerating }: SceneCardProps) {
  const filename = `scene_${String(scene.scene_number).padStart(2, '0')}.png`;
  const imageUrl = api.getVideoConceptImageUrl(slug, tier, filename) + `?v=${cacheKey}`;
  const displayScene = editedScene || scene;

  return (
    <div className="flex gap-4 bg-white rounded-lg border border-gray-200 p-4">
      {/* Image */}
      <div className="flex-shrink-0 relative">
        <AuthImage
          src={imageUrl}
          alt={`Scene ${scene.scene_number}`}
          className="w-40 h-28 object-cover rounded-lg"
        />
        {isCheckpoint && onRegenerate && (
          <button
            onClick={() => onRegenerate(scene.scene_number)}
            disabled={regenerating}
            className="absolute bottom-1 right-1 px-2 py-0.5 text-xs bg-white/90 hover:bg-white text-gray-700 rounded shadow border border-gray-200 disabled:opacity-50"
            title="Regenerate this scene image"
          >
            {regenerating ? (
              <span className="inline-flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Regen...
              </span>
            ) : 'Regen'}
          </button>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">Scene {scene.scene_number}</span>
          <span className="text-xs text-gray-500">{scene.duration_seconds}s</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{scene.shot_type}</span>
          {scene.camera_motion && (
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{scene.camera_motion}</span>
          )}
        </div>

        {isEditing && onSceneEdit ? (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 font-medium">Setting</label>
              <input
                type="text"
                value={displayScene.setting}
                onChange={(e) => onSceneEdit(scene.scene_number, 'setting', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            {(displayScene.narration !== null && displayScene.narration !== undefined) && (
              <div>
                <label className="text-xs text-gray-500 font-medium">Narration</label>
                <textarea
                  value={displayScene.narration || ''}
                  onChange={(e) => onSceneEdit(scene.scene_number, 'narration', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            )}
            {(displayScene.dialogue !== null && displayScene.dialogue !== undefined) && (
              <div>
                <label className="text-xs text-gray-500 font-medium">Dialogue</label>
                <textarea
                  value={displayScene.dialogue || ''}
                  onChange={(e) => onSceneEdit(scene.scene_number, 'dialogue', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            )}
            {(displayScene.overlay_text !== null && displayScene.overlay_text !== undefined) && (
              <div>
                <label className="text-xs text-gray-500 font-medium">Overlay Text</label>
                <input
                  type="text"
                  value={displayScene.overlay_text || ''}
                  onChange={(e) => onSceneEdit(scene.scene_number, 'overlay_text', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-1">{displayScene.setting}</p>

            {displayScene.narration && (
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium text-gray-500">Narration:</span> {displayScene.narration}
              </p>
            )}

            {displayScene.dialogue && (
              <p className="text-sm text-gray-700 mt-1 italic">
                <span className="font-medium text-gray-500 not-italic">Dialogue:</span> &ldquo;{displayScene.dialogue}&rdquo;
              </p>
            )}

            {displayScene.overlay_text && (
              <p className="text-xs text-indigo-600 mt-1">
                <span className="font-medium">Overlay:</span> {displayScene.overlay_text}
              </p>
            )}

            {displayScene.sound_effect && (
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-medium">SFX:</span> {displayScene.sound_effect}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Cost Display ──────────────────────────────────────────────
function CostEstimate({ slug, tier }: { slug: string; tier: string }) {
  const [cost, setCost] = useState<{ total: number; totalWithRetries: number; breakdown: { images: number; video: number; voiceover: number } } | null>(null);

  useEffect(() => {
    api.getVideoConceptCostEstimate(slug, tier).then(setCost).catch(() => {});
  }, [slug, tier]);

  if (!cost) return null;

  const colorClass = cost.total < 2 ? 'text-green-700 bg-green-50 border-green-200'
    : cost.total < 5 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className={`px-4 py-2 rounded-lg border text-sm ${colorClass}`}>
      <span className="font-medium">Estimated cost: ${cost.total.toFixed(2)}</span>
      <span className="ml-2 opacity-75">
        (images: ${cost.breakdown.images.toFixed(3)}, animation: ${cost.breakdown.video.toFixed(2)})
      </span>
      {cost.totalWithRetries > cost.total && (
        <span className="ml-2 opacity-60">
          &middot; with retries: ~${cost.totalWithRetries.toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ── StoryboardViewer Modal ──────────────────────────────────
interface StoryboardViewerProps {
  slug: string;
  tier?: string;
  mode?: 'review' | 'checkpoint';
  onClose: () => void;
  onApprove: (slug: string, tier: string) => Promise<void>;
  onReject: (slug: string) => Promise<void>;
  onContinue?: (slug: string) => Promise<void>;
}

export default function StoryboardViewer({ slug, tier = 'nano', mode = 'review', onClose, onApprove, onReject, onContinue }: StoryboardViewerProps) {
  const [script, setScript] = useState<VideoScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  // Per-scene regeneration state
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<number>>(new Set());
  const [imageCacheKey, setImageCacheKey] = useState(0);

  // Script editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState<VideoScriptData | null>(null);
  const [savingScript, setSavingScript] = useState(false);
  const [scriptEdited, setScriptEdited] = useState(false);

  useEffect(() => {
    api.getVideoConceptScript(slug, tier)
      .then(setScript)
      .catch((err) => setError(err.message || 'Failed to load script'))
      .finally(() => setLoading(false));
  }, [slug, tier]);

  const handleApprove = async (approvalTier: string) => {
    setActing(true);
    try {
      await onApprove(slug, approvalTier);
      toast.success(`Approved "${slug}" — ${approvalTier} production queued`);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      await onReject(slug);
      toast.success(`Rejected "${slug}" — reset to new`);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleContinue = async () => {
    if (!onContinue) return;
    setActing(true);
    try {
      await onContinue(slug);
      toast.success(`Production resumed for "${slug}"`);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleRegenerate = useCallback(async (sceneNum: number) => {
    setRegeneratingScenes(prev => new Set(prev).add(sceneNum));
    try {
      await api.regenerateSceneImage(slug, tier, sceneNum);
      toast.success(`Scene ${sceneNum} regenerated`);
      setImageCacheKey(k => k + 1);
    } catch (err: any) {
      toast.error(err.message || 'Regeneration failed');
    } finally {
      setRegeneratingScenes(prev => {
        const next = new Set(prev);
        next.delete(sceneNum);
        return next;
      });
    }
  }, [slug, tier]);

  // Script editing
  const startEditing = () => {
    if (script) {
      setEditedScript(JSON.parse(JSON.stringify(script)));
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedScript(null);
  };

  const handleSceneEdit = (sceneNum: number, field: string, value: string) => {
    if (!editedScript) return;
    setEditedScript(prev => {
      if (!prev) return prev;
      const updated = { ...prev, scenes: prev.scenes.map(s =>
        s.scene_number === sceneNum ? { ...s, [field]: value } : s
      )};
      return updated;
    });
  };

  const handleTitleEdit = (title: string) => {
    if (!editedScript) return;
    setEditedScript(prev => prev ? { ...prev, title } : prev);
  };

  const saveScript = async () => {
    if (!editedScript) return;
    setSavingScript(true);
    try {
      await api.updateVideoConceptScript(slug, tier, editedScript);
      setScript(editedScript);
      setIsEditing(false);
      setEditedScript(null);
      setScriptEdited(true);
      toast.success('Script saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save script');
    } finally {
      setSavingScript(false);
    }
  };

  const isCheckpoint = mode === 'checkpoint';
  const anyRegenerating = regeneratingScenes.size > 0;
  const displayScript = isEditing ? editedScript : script;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-xl border-b">
          <div className="min-w-0 flex-1">
            {loading ? (
              <h2 className="text-lg font-semibold text-gray-900">Loading storyboard...</h2>
            ) : error ? (
              <h2 className="text-lg font-semibold text-red-600">Error loading storyboard</h2>
            ) : displayScript ? (
              <>
                {isEditing ? (
                  <input
                    type="text"
                    value={displayScript.title}
                    onChange={(e) => handleTitleEdit(e.target.value)}
                    className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{displayScript.title}</h2>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                  {isCheckpoint && (
                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                      Review Production Images
                    </span>
                  )}
                  <span>{displayScript.total_duration_seconds}s total</span>
                  <span>{displayScript.scenes.length} scenes</span>
                  {displayScript.visual_style && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{displayScript.visual_style}</span>}
                  {displayScript.music_mood && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{displayScript.music_mood}</span>}
                  {displayScript.color_palette && <span className="bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">{displayScript.color_palette}</span>}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isCheckpoint && script && !isEditing && (
              <button
                onClick={startEditing}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Edit script"
              >
                Edit Script
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveScript}
                  disabled={savingScript}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingScript ? 'Saving...' : 'Save Script'}
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Script edited warning */}
        {scriptEdited && !isEditing && (
          <div className="mx-6 mt-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Script edited — images may not match. Regenerate affected scenes if needed.
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="text-center py-12 text-gray-400">Loading script and images...</div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
          {displayScript?.scenes.map((scene) => (
            <SceneCard
              key={scene.scene_number}
              scene={script!.scenes.find(s => s.scene_number === scene.scene_number) || scene}
              slug={slug}
              tier={tier}
              cacheKey={imageCacheKey}
              isCheckpoint={isCheckpoint}
              isEditing={isEditing}
              editedScene={isEditing ? editedScript?.scenes.find(s => s.scene_number === scene.scene_number) : undefined}
              onSceneEdit={handleSceneEdit}
              onRegenerate={handleRegenerate}
              regenerating={regeneratingScenes.has(scene.scene_number)}
            />
          ))}
        </div>

        {/* Footer */}
        {script && !error && (
          <div className="px-6 py-4 bg-white rounded-b-xl border-t space-y-3">
            {/* Cost estimate — show for non-nano tiers */}
            {tier !== 'nano' && <CostEstimate slug={slug} tier={tier} />}

            <div className="flex items-center justify-between">
              <button
                onClick={handleReject}
                disabled={acting || isEditing}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                Reject
              </button>
              <div className="flex gap-2">
                {isCheckpoint ? (
                  /* Checkpoint mode: Continue Production button */
                  <button
                    onClick={handleContinue}
                    disabled={acting || anyRegenerating || isEditing}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {acting ? 'Resuming...' : anyRegenerating ? 'Regenerating...' : 'Continue Production'}
                  </button>
                ) : (
                  /* Review mode: Produce Draft/Final buttons */
                  <>
                    <button
                      onClick={() => handleApprove('draft')}
                      disabled={acting}
                      className="px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                    >
                      {acting ? 'Queuing...' : 'Produce Draft'}
                    </button>
                    <button
                      onClick={() => handleApprove('final')}
                      disabled={acting}
                      className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {acting ? 'Queuing...' : 'Produce Final'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
