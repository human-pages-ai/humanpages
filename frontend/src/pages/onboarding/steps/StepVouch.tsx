import { useEffect } from 'react';
import { VouchCard } from '../../../components/shared/VouchCard';

interface StepVouchProps {
  username: string;
  setUsername: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
  userName?: string;
}

const ADJECTIVES = ['swift', 'bright', 'clever', 'smart', 'keen', 'nimble', 'quick', 'ready', 'bold', 'calm'];

function generateUsername(name?: string): string {
  let baseName = '';
  if (name) {
    baseName = name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 15);
  }
  if (baseName && baseName.length >= 2) {
    return `${baseName}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
  }
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  return `${adj}${Math.floor(Math.random() * 100)}`;
}

export function StepVouch({ username, setUsername, onNext, onSkip: _onSkip, error, userName }: StepVouchProps) {
  useEffect(() => {
    if (!username) setUsername(generateUsername(userName));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Build Trust</h2>
      <p className="text-slate-600 mb-6">People who know your work can vouch for you. This builds trust with agents.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      <VouchCard username={username} onUsernameChange={setUsername} />

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
