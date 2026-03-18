import { useEffect } from 'react';

interface StepVouchProps {
  username: string;
  setUsername: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
  userEmail?: string;
}

const ADJECTIVES = ['Happy', 'Clever', 'Bright', 'Swift', 'Smart', 'Creative', 'Diligent', 'Energetic', 'Friendly', 'Keen', 'Lively', 'Nimble', 'Quick', 'Reliable', 'Stellar'];
const NOUNS = ['Bear', 'Eagle', 'Fox', 'Lion', 'Otter', 'Panda', 'Raven', 'Tiger', 'Wolf', 'Zebra', 'Atlas', 'Beacon', 'Comet', 'Dragon', 'Echo'];

function generateUsername(email?: string): string {
  if (email && email.includes('@')) {
    const localPart = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    if (localPart.length > 3) return localPart;
  }
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const random = Math.random().toString(36).slice(2, 6);
  return `${adj}${noun}${random}`.toLowerCase();
}

export function StepVouch({
  username,
  setUsername,
  onNext,
  onSkip,
  error,
  userEmail,
}: StepVouchProps) {
  // Pre-generate username on mount if empty
  useEffect(() => {
    if (!username) {
      setUsername(generateUsername(userEmail));
    }
  }, []);

  const profileUrl = `humanpages.ai/user/${username}`;
  const shareText = 'Vouch for me on HumanPages — the AI hiring platform with 0% commission';

  const handleShare = async () => {
    const shareUrl = `https://${profileUrl}`;
    const shareData = {
      title: 'HumanPages',
      text: shareText,
      url: shareUrl,
    };

    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await fallbackCopy(shareUrl);
        }
      }
    } else {
      // Fallback to clipboard copy
      await fallbackCopy(shareUrl);
    }
  };

  const fallbackCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      alert('Copied to clipboard!');
    } catch {
      alert('Failed to copy link');
    }
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Build Trust</h2>
      <p className="text-slate-600 mb-6">People who know your work can vouch for you. This builds trust with agents and helps you get hired faster.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Vouch Progress */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">Vouches Received</p>
          <span className="text-2xl font-bold text-orange-500">0/10</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500" style={{ width: '0%' }}></div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Share your profile and ask colleagues to vouch for you</p>
      </div>

      {/* Username Input */}
      <div className="mb-6">
        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Your profile link</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">humanpages.ai/user/</span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 50).replace(/\s+/g, '-').toLowerCase())}
            placeholder="your-username"
            className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">Alphanumeric and hyphens only</p>
      </div>

      {/* Share Preview & Button */}
      <div className="mb-6">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
          <p className="text-xs font-medium text-slate-600 mb-1">Share preview:</p>
          <p className="text-sm text-slate-700">{shareText}</p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="w-full py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 active:bg-blue-200 border border-blue-200 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Share Profile
        </button>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Next →</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip →</button>
      </div>
    </>
  );
}
