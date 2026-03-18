import { useState } from 'react';

interface StepFinishProps {
  emailVerified: boolean;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  twitterUrl: string;
  setTwitterUrl: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  instagramUrl: string;
  setInstagramUrl: (v: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  facebookUrl: string;
  setFacebookUrl: (v: string) => void;
  tiktokUrl: string;
  setTiktokUrl: (v: string) => void;
  platformPresence: string[];
  setPlatformPresence: (v: string[]) => void;
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
  linkedinUrl, setLinkedinUrl, githubUrl, setGithubUrl,
  twitterUrl, setTwitterUrl, websiteUrl, setWebsiteUrl,
  instagramUrl, setInstagramUrl, youtubeUrl, setYoutubeUrl,
  facebookUrl, setFacebookUrl, tiktokUrl, setTiktokUrl,
  platformPresence, setPlatformPresence,
  onLinkedInConnect, onGitHubConnect,
  onNext, onSkip: _onSkip, isLoading, error, setError,
  profileData,
}: StepFinishProps) {
  const [connectingLI, setConnectingLI] = useState(false);
  const [connectingGH, setConnectingGH] = useState(false);
  const [showMoreSocials, setShowMoreSocials] = useState(true);
  const [newPlatformPresence, setNewPlatformPresence] = useState('');

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
    !!linkedinUrl?.trim() || !!githubUrl?.trim() || !!twitterUrl?.trim() || !!websiteUrl?.trim(),
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
  const inputCls = "w-full px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Verify Your Identity</h2>
      <p className="text-slate-600 mb-6">Connect your professional accounts to build trust and appear higher in search results</p>

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}
      {isLoading && <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin flex-shrink-0" /><span>Saving your profile — please don't close this page...</span></div>}

      {/* Verification & Social Links */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Verification</h3>
        <p className="text-xs text-slate-500 mb-3">Verified accounts build trust and appear higher in search</p>
      </div>
      <div className="space-y-3 mb-6">
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${emailVerified ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-600'}`}><span aria-hidden="true">{emailVerified ? '✓' : '📧'}</span></div>
          <div><p className="font-medium text-slate-900">Email Verification</p><p className="text-xs text-slate-600">{emailVerified ? 'Verified' : 'Check your email'}</p></div></div>
          {emailVerified && <span className="text-xs font-medium text-green-600">Connected</span>}
        </div>
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600"><span aria-hidden="true">in</span></div>
          <div><p className="font-medium text-slate-900">LinkedIn</p><p className="text-xs text-slate-600">Verify your professional identity</p></div></div>
          <button type="button" onClick={handleLI} disabled={connectingLI} aria-label="Connect LinkedIn account" className="text-xs font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-blue-50 active:bg-blue-100 px-4 py-2 rounded-lg disabled:opacity-50 min-h-[44px]">{connectingLI ? 'Opening...' : 'Connect'}</button>
        </div>
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-800 text-white text-xs font-bold"><span aria-hidden="true">&lt;/&gt;</span></div>
          <div><p className="font-medium text-slate-900">GitHub</p><p className="text-xs text-slate-600">Showcase your code contributions</p></div></div>
          <button type="button" onClick={handleGH} disabled={connectingGH} aria-label="Connect GitHub account" className="text-xs font-medium text-slate-700 hover:text-slate-900 active:text-slate-950 bg-slate-100 active:bg-slate-200 px-4 py-2 rounded-lg disabled:opacity-50 min-h-[44px]">{connectingGH ? 'Opening...' : 'Connect'}</button>
        </div>
      </div>

      {/* Social & Web Presence */}
      <div className="mb-6 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Social & Web Presence</h3>
        <p className="text-xs text-slate-500 mb-3">Help clients find you across the web</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label htmlFor="linkedin-url" className="block text-xs font-medium text-slate-600 mb-1">LinkedIn</label><input id="linkedin-url" type="url" value={linkedinUrl} onChange={(e) => { setLinkedinUrl(e.target.value); if (error) setError(''); }} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setLinkedinUrl('https://' + val); }} placeholder="linkedin.com/in/..." className={inputCls} /></div>
            <div><label htmlFor="github-url" className="block text-xs font-medium text-slate-600 mb-1">GitHub</label><input id="github-url" type="url" value={githubUrl} onChange={(e) => { setGithubUrl(e.target.value); if (error) setError(''); }} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setGithubUrl('https://' + val); }} placeholder="github.com/..." className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label htmlFor="twitter-url" className="block text-xs font-medium text-slate-600 mb-1">Twitter / X</label><input id="twitter-url" type="url" value={twitterUrl} onChange={(e) => { setTwitterUrl(e.target.value); if (error) setError(''); }} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setTwitterUrl('https://' + val); }} placeholder="x.com/..." className={inputCls} /></div>
            <div><label htmlFor="website-url" className="block text-xs font-medium text-slate-600 mb-1">Personal Website</label><input id="website-url" type="url" value={websiteUrl} onChange={(e) => { setWebsiteUrl(e.target.value); if (error) setError(''); }} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setWebsiteUrl('https://' + val); }} placeholder="yoursite.com" className={inputCls} /></div>
          </div>
          {!showMoreSocials ? (
            <button type="button" onClick={() => setShowMoreSocials(true)} className="w-full py-2.5 min-h-[44px] text-xs text-orange-600 hover:text-orange-700 active:text-orange-800 font-medium border border-dashed border-orange-200 rounded-lg hover:bg-orange-50 active:bg-orange-100 transition-colors">+ More social accounts (Instagram, YouTube, TikTok, Facebook)</button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div><label htmlFor="instagram-url" className="block text-xs font-medium text-slate-600 mb-1">Instagram</label><input id="instagram-url" type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setInstagramUrl('https://' + val); }} placeholder="instagram.com/..." className={inputCls} /></div>
              <div><label htmlFor="youtube-url" className="block text-xs font-medium text-slate-600 mb-1">YouTube</label><input id="youtube-url" type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setYoutubeUrl('https://' + val); }} placeholder="youtube.com/@..." className={inputCls} /></div>
              <div><label htmlFor="tiktok-url" className="block text-xs font-medium text-slate-600 mb-1">TikTok</label><input id="tiktok-url" type="url" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setTiktokUrl('https://' + val); }} placeholder="tiktok.com/@..." className={inputCls} /></div>
              <div><label htmlFor="facebook-url" className="block text-xs font-medium text-slate-600 mb-1">Facebook</label><input id="facebook-url" type="url" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setFacebookUrl('https://' + val); }} placeholder="facebook.com/..." className={inputCls} /></div>
            </div>
          )}
        </div>
      </div>

      {/* Platform Presence */}
      <div className="mb-6 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Platform Presence (Optional)</h3>
        <p className="text-xs text-slate-500 mb-3">Add your reputation badges and platform achievements</p>
        {platformPresence.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {platformPresence.map((item, idx) => (
              <button key={idx} type="button" onClick={() => setPlatformPresence(platformPresence.filter((_, i) => i !== idx))} aria-label={`Remove: ${item}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 min-h-[44px]">
                {item}<span aria-hidden="true" className="text-orange-200 ml-0.5 text-base leading-none">&times;</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPlatformPresence}
            onChange={(e) => setNewPlatformPresence(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const val = newPlatformPresence.trim(); if (val && !platformPresence.some(p => p.toLowerCase() === val.toLowerCase())) { setPlatformPresence([...platformPresence, val]); setNewPlatformPresence(''); } } }}
            placeholder="e.g., Top Rated seller, 50k followers, 5-star rating on marketplace..."
            className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => { const val = newPlatformPresence.trim(); if (val && !platformPresence.some(p => p.toLowerCase() === val.toLowerCase())) { setPlatformPresence([...platformPresence, val]); setNewPlatformPresence(''); } }}
            disabled={!newPlatformPresence.trim()}
            className="px-4 py-2.5 sm:py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 min-h-[44px]"
          >
            Add
          </button>
        </div>
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
