import { useState, useEffect, useRef } from 'react';
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
function SceneCard({ scene, slug, tier }: { scene: VideoScene; slug: string; tier: string }) {
  const filename = `scene_${String(scene.scene_number).padStart(2, '0')}.png`;
  const imageUrl = api.getVideoConceptImageUrl(slug, tier, filename);

  return (
    <div className="flex gap-4 bg-white rounded-lg border border-gray-200 p-4">
      {/* Image */}
      <div className="flex-shrink-0">
        <AuthImage
          src={imageUrl}
          alt={`Scene ${scene.scene_number}`}
          className="w-40 h-28 object-cover rounded-lg"
        />
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

        <p className="text-sm text-gray-600 mb-1">{scene.setting}</p>

        {scene.narration && (
          <p className="text-sm text-gray-700 mt-1">
            <span className="font-medium text-gray-500">Narration:</span> {scene.narration}
          </p>
        )}

        {scene.dialogue && (
          <p className="text-sm text-gray-700 mt-1 italic">
            <span className="font-medium text-gray-500 not-italic">Dialogue:</span> &ldquo;{scene.dialogue}&rdquo;
          </p>
        )}

        {scene.overlay_text && (
          <p className="text-xs text-indigo-600 mt-1">
            <span className="font-medium">Overlay:</span> {scene.overlay_text}
          </p>
        )}

        {scene.sound_effect && (
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">SFX:</span> {scene.sound_effect}
          </p>
        )}
      </div>
    </div>
  );
}

// ── StoryboardViewer Modal ──────────────────────────────────
interface StoryboardViewerProps {
  slug: string;
  tier?: string;
  onClose: () => void;
  onApprove: (slug: string, tier: string) => Promise<void>;
  onReject: (slug: string) => Promise<void>;
}

export default function StoryboardViewer({ slug, tier = 'nano', onClose, onApprove, onReject }: StoryboardViewerProps) {
  const [script, setScript] = useState<VideoScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-xl border-b">
          <div className="min-w-0">
            {loading ? (
              <h2 className="text-lg font-semibold text-gray-900">Loading storyboard...</h2>
            ) : error ? (
              <h2 className="text-lg font-semibold text-red-600">Error loading storyboard</h2>
            ) : script ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 truncate">{script.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{script.total_duration_seconds}s total</span>
                  <span>{script.scenes.length} scenes</span>
                  {script.visual_style && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{script.visual_style}</span>}
                  {script.music_mood && <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{script.music_mood}</span>}
                  {script.color_palette && <span className="bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">{script.color_palette}</span>}
                </div>
              </>
            ) : null}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="text-center py-12 text-gray-400">Loading script and images...</div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
          {script?.scenes.map((scene) => (
            <SceneCard key={scene.scene_number} scene={scene} slug={slug} tier={tier} />
          ))}
        </div>

        {/* Footer */}
        {script && !error && (
          <div className="flex items-center justify-between px-6 py-4 bg-white rounded-b-xl border-t">
            <button
              onClick={handleReject}
              disabled={acting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              Reject
            </button>
            <div className="flex gap-2">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
