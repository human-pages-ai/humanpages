/**
 * Shared vouch/share card — used in both the onboarding wizard (StepVouch)
 * and the dashboard (VouchSection). Single source of truth for the share UX.
 */
import toast from 'react-hot-toast';
import { getProfileUrl, getProfileDisplayUrl } from '../../lib/profileUrl';
import { copyToClipboard } from '../../lib/clipboard';

interface VouchCardProps {
  username?: string;
  userId: string;
  /** Editable username input — only shown in wizard mode */
  onUsernameChange?: (v: string) => void;
  /** Number of vouches received */
  vouchCount?: number;
  /** Max vouch target */
  vouchTarget?: number;
}

const SHARE_TEXT = 'Vouch for me on HumanPages — the AI hiring platform with 0% commission';

export function VouchCard({ username, userId, onUsernameChange, vouchCount = 0, vouchTarget = 10 }: VouchCardProps) {
  const displayUrl = getProfileDisplayUrl({ id: userId });
  const shareUrl = getProfileUrl({ id: userId });
  const pct = Math.min(100, Math.round((vouchCount / vouchTarget) * 100));

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HumanPages', text: SHARE_TEXT, url: shareUrl });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    // Fallback: copy to clipboard
    const success = await copyToClipboard(`${SHARE_TEXT} ${shareUrl}`);
    if (success) {
      toast.success('Link copied!');
    } else {
      toast.error('Could not copy link');
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-600">Vouches</span>
            <span className="text-sm font-bold text-orange-600">{vouchCount}/{vouchTarget}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Profile URL */}
      <div>
        <label htmlFor="vouch-profile-url" className="block text-xs font-medium text-slate-600 mb-1">Your profile link</label>

        {/* Always show the full computed URL as read-only */}
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg mb-3">
          <span className="text-sm text-slate-700 flex-1 truncate font-mono">{displayUrl}</span>
          <button
            type="button"
            onClick={async () => { const success = await copyToClipboard(shareUrl); if (success) toast.success('Copied!'); }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
          >
            Copy
          </button>
        </div>

        {/* Username edit field — only shown in wizard mode (onUsernameChange provided) */}
        {onUsernameChange && (
          <>
            <label htmlFor="vouch-username" className="block text-xs font-medium text-slate-600 mb-1">Username (optional)</label>
            {!username && (
              <p className="text-xs text-slate-500 mb-1.5">Set a username to get a shorter link</p>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {getProfileDisplayUrl({ id: userId }).replace(/\/[^/]+$/, '/')}
              </span>
              <input
                id="vouch-username"
                type="text"
                value={username || ''}
                onChange={(e) => onUsernameChange(e.target.value.slice(0, 50).replace(/\s+/g, '-').toLowerCase())}
                placeholder="your-username"
                className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Share button */}
      <button
        type="button"
        onClick={handleShare}
        className="w-full py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors text-sm flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        Share & Get Vouched
      </button>
      <p className="text-xs text-slate-500 text-center">Ask colleagues who know your work to vouch for you</p>
    </div>
  );
}
