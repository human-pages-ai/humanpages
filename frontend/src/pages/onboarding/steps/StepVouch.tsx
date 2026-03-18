import { useEffect } from 'react';

interface StepVouchProps {
  username: string;
  setUsername: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
  userName?: string;
}

const ADJECTIVES = ['swift', 'bright', 'clever', 'smart', 'keen', 'nimble', 'quick', 'ready', 'bold', 'calm', 'epic', 'great', 'kind', 'lucky', 'noble', 'rare', 'sure', 'vital', 'wise', 'zippy'];

function generateUsername(name?: string): string {
  // Try to use first name from email or provided name
  let baseName = '';
  if (name) {
    baseName = name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15);
  }

  if (baseName && baseName.length >= 2) {
    // Use first name + 2-3 digit random number
    const randomDigits = String(Math.floor(Math.random() * 1000)).padStart(2, '0');
    return `${baseName}${randomDigits}`;
  }

  // Fallback: adjective + 1-2 digit random number
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const randomDigits = String(Math.floor(Math.random() * 100)).padStart(1, '0');
  return `${adj}${randomDigits}`;
}

export function StepVouch({
  username,
  setUsername,
  onNext,
  onSkip: _onSkip,
  error,
  userName,
}: StepVouchProps) {
  // Pre-generate username on mount if empty
  useEffect(() => {
    if (!username) {
      setUsername(generateUsername(userName));
    }
  }, []);

  const profileUrl = `humanpages.ai/u/${username}`;
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
          <span className="text-sm text-slate-600">humanpages.ai/u/</span>
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

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
