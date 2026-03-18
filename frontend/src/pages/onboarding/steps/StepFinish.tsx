import { useState } from 'react';
import toast from 'react-hot-toast';
import { getPlatformLabel } from '../utils';

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
  externalProfiles: string[];
  setExternalProfiles: React.Dispatch<React.SetStateAction<string[]>>;
  walletAddress: string;
  setWalletAddress: (v: string) => void;
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
    externalProfiles: string[];
  };
}

export function StepFinish({
  emailVerified,
  linkedinUrl, setLinkedinUrl, githubUrl, setGithubUrl,
  twitterUrl, setTwitterUrl, websiteUrl, setWebsiteUrl,
  instagramUrl, setInstagramUrl, youtubeUrl, setYoutubeUrl,
  facebookUrl, setFacebookUrl, tiktokUrl, setTiktokUrl,
  externalProfiles, setExternalProfiles,
  walletAddress, setWalletAddress,
  onLinkedInConnect, onGitHubConnect,
  onNext, onSkip, isLoading, error, setError,
  profileData,
}: StepFinishProps) {
  const [connectingLI, setConnectingLI] = useState(false);
  const [connectingGH, setConnectingGH] = useState(false);
  const [newExtProfile, setNewExtProfile] = useState('');
  const [showMoreSocials, setShowMoreSocials] = useState(!!(instagramUrl || youtubeUrl || facebookUrl || tiktokUrl));

  const handleLI = async () => { setConnectingLI(true); try { await onLinkedInConnect(); } finally { setConnectingLI(false); } };
  const handleGH = async () => { setConnectingGH(true); try { await onGitHubConnect(); } finally { setConnectingGH(false); } };

  const addExternalProfile = () => {
    const trimmed = newExtProfile.trim();
    if (!trimmed || externalProfiles.length >= 10) return;
    const normalizedTrimmed = trimmed.toLowerCase().trim();
    if (externalProfiles.some(u => u.toLowerCase().trim() === normalizedTrimmed)) { toast.error('This profile is already added'); setNewExtProfile(''); return; }
    try {
      new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
    } catch {
      // URL validation failed
      toast.error('Please enter a valid URL');
      return;
    }
    setExternalProfiles(prev => [...prev, trimmed]);
    setNewExtProfile('');
  };

  const removeExternalProfile = (index: number) => {
    setExternalProfiles(prev => prev.filter((_, i) => i !== index));
  };

  // Profile completeness
  const d = profileData;
  const checks = [
    !!d.name?.trim(), !!d.bio?.trim(), !!d.location?.trim(),
    !!d.photoPreview || !!d.oauthPhotoUrl,
    (d.skills?.length || 0) > 0, (d.skills?.length || 0) >= 5,
    (d.languageEntries?.length || 0) > 0, (d.educationEntries?.length || 0) > 0,
    (d.services?.length || 0) > 0,
    !!linkedinUrl?.trim() || !!githubUrl?.trim() || !!twitterUrl?.trim() || !!websiteUrl?.trim(),
    (d.externalProfiles?.length || 0) > 0, emailVerified,
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
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Finish Your Profile</h2>
      <p className="text-slate-600 mb-6">Add links, portfolios, and verify your accounts to build trust</p>

      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}
      {isLoading && <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><div className="w-4 h-4 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin flex-shrink-0" /><span>Saving your profile — please don't close this page...</span></div>}

      {/* Professional Platform Profiles */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Professional Profiles</h3>
        <p className="text-xs text-slate-500 mb-3">Add your freelance platform profiles, portfolio sites, and showcase pages</p>
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">Add your freelance profiles to showcase your ratings and reviews to potential clients</div>
        {externalProfiles.length > 0 && (
          <div className="space-y-2 mb-3">
            {externalProfiles.map((url, idx) => {
              let platform = { name: url, icon: '🔗' };
              try {
                platform = getPlatformLabel(url);
              } catch {
                // URL parsing failed — use default display
              }
              return (
                <div key={idx} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg bg-slate-50">
                  <span className="text-sm flex-shrink-0">{platform.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{platform.name}</p>
                    <p className="text-xs text-slate-400 truncate">{url}</p>
                  </div>
                  <button type="button" onClick={() => removeExternalProfile(idx)} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove ${platform.name}`}>×</button>
                </div>
              );
            })}
          </div>
        )}
        {externalProfiles.length < 10 && (
          <div className="flex gap-2">
            <input type="url" value={newExtProfile} onChange={(e) => setNewExtProfile(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternalProfile(); } }} onBlur={(e) => { const val = e.target.value; if (val && !val.startsWith('http')) setNewExtProfile('https://' + val); }} placeholder="https://fiverr.com/you" className={`flex-1 ${inputCls}`} aria-label="Add professional profile URL" />
            <button type="button" onClick={addExternalProfile} disabled={!newExtProfile.trim()} className="px-4 py-2.5 sm:py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 min-h-[44px] flex-shrink-0">Add</button>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">Fiverr, Upwork, Behance, Dribbble, Stack Overflow, Medium, Kaggle, etc.</p>
      </div>

      {/* Verification */}
      <div className="mb-6 pt-4 border-t border-slate-200">
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
        <div className="p-3 sm:p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-700"><span aria-hidden="true">₿</span></div>
            <div><p className="font-medium text-slate-900">Crypto Wallet (Optional)</p><p className="text-xs text-slate-600">Accept crypto payments from clients</p></div>
          </div>
          <input type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Enter your wallet address (ETH, SOL, etc.)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
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

      {/* Profile Completeness */}
      <div className={`mb-4 sm:mb-6 p-3 sm:p-4 ${c.bg} border rounded-lg`}>
        <p className="text-sm font-medium text-slate-900 mb-2">Your profile is <span className={`${c.text} font-bold`}>{pct}%</span> complete{pct >= 80 ? ' — Almost there!' : ''}!</p>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness"><div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} disabled={isLoading} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">{isLoading ? 'Saving your profile...' : 'Go to Dashboard'}</button>
        <button type="button" onClick={onSkip} disabled={isLoading} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50">{isLoading ? 'Saving...' : 'Finish without verifying'}</button>
        <p className="text-xs text-slate-500 text-center">Step 7 of 7</p>
      </div>
    </>
  );
}
