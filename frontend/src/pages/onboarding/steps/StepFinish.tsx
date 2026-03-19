import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SuggestionInput } from '../components/SuggestionInput';
import type { PlatformEntry } from '../types';

const PLATFORM_SUGGESTIONS = [
  'YouTube', 'Instagram', 'TikTok', 'Twitter/X', 'LinkedIn', 'GitHub',
  'Behance', 'Dribbble', 'Medium', 'Substack', 'Personal Website', 'Marketplace'
];

interface StepFinishProps {
  emailVerified: boolean;
  platformPresence: PlatformEntry[];
  setPlatformPresence: (v: PlatformEntry[]) => void;
  onLinkedInConnect: () => Promise<void>;
  onGitHubConnect: () => Promise<void>;
  onNext: () => void;
  onSkip: () => void;
  isLoading: boolean;
  error: string;
  setError: (v: string) => void;
  profileData: {
    name: string;
    bio: string;
    location: string;
    skills: string[];
    languageEntries: any[];
    photoPreview: string | null;
    oauthPhotoUrl: string | null;
    services: any[];
    educationEntries: any[];
  };
}

export function StepFinish({
  emailVerified,
  platformPresence, setPlatformPresence,
  onLinkedInConnect, onGitHubConnect,
  onNext, onSkip: _onSkip, isLoading, error,
  profileData,
}: StepFinishProps) {
  const { t } = useTranslation();
  const [connectingLI, setConnectingLI] = useState(false);
  const [connectingGH, setConnectingGH] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDetails, setNewDetails] = useState('');

  const handleLI = async () => { setConnectingLI(true); try { await onLinkedInConnect(); } finally { setConnectingLI(false); } };
  const handleGH = async () => { setConnectingGH(true); try { await onGitHubConnect(); } finally { setConnectingGH(false); } };

  // Profile completeness
  const d = profileData;
  const checks = [
    !!d.name?.trim(), !!d.bio?.trim(), !!d.location?.trim(),
    !!d.photoPreview || !!d.oauthPhotoUrl,
    (d.skills?.length || 0) > 0, (d.skills?.length || 0) >= 5,
    (d.languageEntries?.length || 0) > 0, (d.educationEntries?.length || 0) > 0,
    (d.services?.length || 0) > 0,
    emailVerified,
  ];
  const filled = checks.filter(Boolean).length;
  const pct = Math.round((filled / checks.length) * 100);
  const color = pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'slate';
  const colorMap: Record<string, { bg: string; bar: string; text: string }> = {
    green: { bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', text: 'text-green-600' },
    orange: { bg: 'bg-orange-50 border-orange-200', bar: 'bg-orange-500', text: 'text-orange-600' },
    slate: { bg: 'bg-slate-50 border-slate-200', bar: 'bg-slate-500', text: 'text-slate-600' },
  };
  const c = colorMap[color];

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.finish.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.finish.subtitle')}</p>

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}
      {isLoading && <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin flex-shrink-0" /><span>Saving your profile — please don't close this page...</span></div>}

      {/* Verification & Social Links */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('onboarding.finish.verificationTitle')}</h3>
        <p className="text-xs text-slate-500 mb-3">Verified accounts build trust and appear higher in search</p>
      </div>
      <div className="space-y-3 mb-6">
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${emailVerified ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'}`}><span aria-hidden="true">{emailVerified ? '✓' : '📧'}</span></div>
          <div><p className="font-medium text-slate-900">{t('onboarding.finish.emailTitle')}</p><p className="text-xs text-slate-600">{emailVerified ? 'Verified' : 'Check your email (including spam)'}</p></div></div>
          {emailVerified && <span className="text-xs font-medium text-green-600">Connected</span>}
        </div>
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600"><span aria-hidden="true">in</span></div>
          <div><p className="font-medium text-slate-900">{t('onboarding.finish.linkedinTitle')}</p><p className="text-xs text-slate-600">{t('onboarding.finish.linkedinDesc')}</p></div></div>
          <button type="button" onClick={handleLI} disabled={connectingLI} aria-label="Connect LinkedIn account" className="text-xs font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-blue-50 active:bg-blue-100 px-4 py-2 rounded-lg disabled:opacity-50 min-h-[44px]">{connectingLI ? 'Opening...' : 'Connect'}</button>
        </div>
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-800 text-white text-xs font-bold"><span aria-hidden="true">&lt;/&gt;</span></div>
          <div><p className="font-medium text-slate-900">{t('onboarding.finish.githubTitle')}</p><p className="text-xs text-slate-600">{t('onboarding.finish.githubDesc')}</p></div></div>
          <button type="button" onClick={handleGH} disabled={connectingGH} aria-label="Connect GitHub account" className="text-xs font-medium text-slate-700 hover:text-slate-900 active:text-slate-950 bg-slate-100 active:bg-slate-200 px-4 py-2 rounded-lg disabled:opacity-50 min-h-[44px]">{connectingGH ? 'Opening...' : 'Connect'}</button>
        </div>
      </div>


      {/* Platform Presence */}
      <div className="mb-6 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('onboarding.finish.platformsTitle')}</h3>
        <p className="text-xs text-slate-500 mb-3">{t('onboarding.finish.platformsHint')}</p>
        {platformPresence.length > 0 && (
          <div className="mb-4 space-y-2">
            {platformPresence.map((entry, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{entry.platform}</p>
                  {entry.url && <p className="text-xs text-slate-600 truncate">{entry.url}</p>}
                  {entry.details && <p className="text-xs text-slate-500 mt-1">{entry.details}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setPlatformPresence(platformPresence.filter((_, i) => i !== idx))}
                  aria-label={`Remove: ${entry.platform}`}
                  className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {platformPresence.length < 10 && (
          <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-3">
            <div>
              <label htmlFor="platform-name" className="block text-sm font-medium text-slate-700 mb-1">Platform Name</label>
              <SuggestionInput
                value={newPlatform}
                onChange={(v) => setNewPlatform(v)}
                suggestions={PLATFORM_SUGGESTIONS.map(p => ({ value: p, label: p }))}
                placeholder="e.g., YouTube, Instagram, LinkedIn..."
              />
            </div>
            <div>
              <label htmlFor="platform-url" className="block text-sm font-medium text-slate-700 mb-1">URL (Optional)</label>
              <input
                id="platform-url"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="e.g., https://youtube.com/@yourhandle"
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="platform-details" className="block text-sm font-medium text-slate-700 mb-1">Details (Optional)</label>
              <input
                id="platform-details"
                type="text"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder="e.g., 50k subscribers, Top Rated seller, 5-star average"
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (newPlatform.trim()) {
                    setPlatformPresence([...platformPresence, { platform: newPlatform.trim(), url: newUrl.trim(), details: newDetails.trim() }]);
                    setNewPlatform('');
                    setNewUrl('');
                    setNewDetails('');
                  }
                }}
                disabled={!newPlatform.trim()}
                className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {t('onboarding.finish.addPlatformButton')}
              </button>
              {(newPlatform || newUrl || newDetails) && (
                <button
                  type="button"
                  onClick={() => { setNewPlatform(''); setNewUrl(''); setNewDetails(''); }}
                  className="px-4 py-2.5 sm:py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile Completeness */}
      <div className={`mb-4 sm:mb-6 p-3 sm:p-4 ${c.bg} border rounded-lg`}>
        <p className="text-sm font-medium text-slate-900 mb-2">Your profile is <span className={`${c.text} font-bold`}>{pct}%</span> complete{pct >= 80 ? ' — Almost there!' : ''}!</p>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness"><div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} disabled={isLoading} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Complete profile">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
