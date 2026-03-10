import React from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from './types';
import LocationAutocomplete from '../LocationAutocomplete';
import ProfilePhoto from './ProfilePhoto';

interface Props {
  profile: Profile;
  editingProfile: boolean;
  setEditingProfile: (v: boolean) => void;
  hasWallet: boolean;
  onScrollToWallets?: () => void;
  profileForm: {
    name: string;
    bio: string;
    location: string;
    neighborhood: string;
    locationGranularity: 'city' | 'neighborhood';
    locationLat?: number;
    locationLng?: number;
    skills: string;
    equipment: string[];
    languages: string[];
    yearsOfExperience: string;
    contactEmail: string;
    telegram: string;
    whatsapp: string;
    paymentMethods: string;
    hideContact: boolean;
    username?: string;
    linkedinUrl: string;
    twitterUrl: string;
    githubUrl: string;
    facebookUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    websiteUrl: string;
    tiktokUrl: string;
    twitterFollowers: string;
    instagramFollowers: string;
    youtubeFollowers: string;
    tiktokFollowers: string;
    linkedinFollowers: string;
    facebookFollowers: string;
  };
  setProfileForm: (v: any) => void;
  saving: boolean;
  autoSaving?: boolean;
  onSaveProfile: () => void;
  onCheckUsername?: (username: string) => Promise<boolean>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: () => Promise<void>;
}

export default function ProfileSection({
  profile,
  editingProfile,
  setEditingProfile,
  hasWallet,
  onScrollToWallets,
  profileForm,
  setProfileForm,
  saving,
  autoSaving,
  onSaveProfile,
  onCheckUsername,
  onUploadPhoto,
  onDeletePhoto,
}: Props) {
  const { t } = useTranslation();

  const [usernameError, setUsernameError] = React.useState<string>('');
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const usernameCheckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNonCrypto, setShowNonCrypto] = React.useState(Boolean(profileForm.paymentMethods));

  React.useEffect(() => {
    if (editingProfile) {
      setShowNonCrypto(Boolean(profileForm.paymentMethods));
    }
  }, [editingProfile]);

  const EQUIPMENT_OPTIONS = [
    'car', 'bike', 'drone', 'camera', 'smartphone',
    'laptop', 'tools', 'van', 'motorcycle'
  ];

  const LANGUAGE_OPTIONS = [
    'English', 'Spanish', 'Chinese', 'Hindi', 'Filipino',
    'Vietnamese', 'Turkish', 'Thai', 'French', 'Arabic',
    'Portuguese', 'German', 'Japanese', 'Korean', 'Russian'
  ];

  const toggleEquipment = (item: string) => {
    const current = profileForm.equipment || [];
    if (current.includes(item)) {
      setProfileForm({ ...profileForm, equipment: current.filter(e => e !== item) });
    } else {
      setProfileForm({ ...profileForm, equipment: [...current, item] });
    }
  };

  const toggleLanguage = (lang: string) => {
    const current = profileForm.languages || [];
    if (current.includes(lang)) {
      setProfileForm({ ...profileForm, languages: current.filter(l => l !== lang) });
    } else {
      setProfileForm({ ...profileForm, languages: [...current, lang] });
    }
  };

  const validateUsername = (username: string) => {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    if (!username) {
      setUsernameError('');
      setCheckingUsername(false);
      return true;
    }
    if (username.length < 3 || username.length > 30) {
      setUsernameError(t('dashboard.profile.usernameLength'));
      setCheckingUsername(false);
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError(t('dashboard.profile.usernameChars'));
      setCheckingUsername(false);
      return false;
    }
    setUsernameError('');
    // Debounced uniqueness check
    if (onCheckUsername && username !== profile.username) {
      setCheckingUsername(true);
      usernameCheckTimer.current = setTimeout(async () => {
        const available = await onCheckUsername(username);
        setCheckingUsername(false);
        if (!available) {
          setUsernameError(t('dashboard.profile.usernameTaken'));
        }
      }, 500);
    }
    return true;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('dashboard.profile.title')}</h2>
        <button
          onClick={() => setEditingProfile(!editingProfile)}
          className="text-blue-600 hover:text-blue-500 text-sm"
        >
          {editingProfile ? t('common.cancel') : t('common.edit')}
        </button>
      </div>

      <div className="mb-4">
        <ProfilePhoto
          photoUrl={profile.profilePhotoUrl}
          photoStatus={profile.profilePhotoStatus}
          name={profile.name}
          onUpload={onUploadPhoto}
          onDelete={onDeletePhoto}
          size="md"
        />
      </div>

      {editingProfile ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
            <input
              id="profile-name"
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="profile-username" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.username')}</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                @
              </span>
              <input
                id="profile-username"
                type="text"
                value={profileForm.username || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, username: e.target.value });
                  validateUsername(e.target.value);
                }}
                className={`flex-1 block w-full px-3 py-2 border rounded-r-md ${
                  usernameError ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="your_username"
              />
            </div>
            {checkingUsername && (
              <p className="mt-1 text-xs text-gray-400">{t('dashboard.profile.checkingUsername')}</p>
            )}
            {usernameError && !checkingUsername && (
              <p className="mt-1 text-sm text-red-600">{usernameError}</p>
            )}
            {profileForm.username && !usernameError && !checkingUsername && (
              <p className="mt-1 text-xs text-gray-500">
                {t('dashboard.profile.profileUrl', { username: profileForm.username })}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.bio')}</label>
            <textarea
              id="profile-bio"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="profile-location" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.location')}</label>
            <LocationAutocomplete
              id="profile-location"
              value={profileForm.neighborhood && profileForm.location
                ? `${profileForm.neighborhood}, ${profileForm.location}`
                : profileForm.location}
              onChange={(loc, lat, lng, neighborhood) => {
                setProfileForm({
                  ...profileForm,
                  location: loc,
                  neighborhood: neighborhood || '',
                  ...(lat != null && lng != null ? { locationLat: lat, locationLng: lng } : {}),
                });
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {profileForm.neighborhood && (
              <>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.locationGranularity === 'neighborhood'}
                    onChange={(e) => setProfileForm({
                      ...profileForm,
                      locationGranularity: e.target.checked ? 'neighborhood' : 'city',
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t('dashboard.profile.showNeighborhood')}
                    <span className="text-gray-500 text-xs ml-1">({profileForm.neighborhood})</span>
                  </span>
                </label>
                <p className="text-xs text-gray-400 ml-6">{t('dashboard.profile.neighborhoodHint')}</p>
              </>
            )}
          </div>
          <div>
            <label htmlFor="profile-skills" className="block text-sm font-medium text-gray-700">
              {t('dashboard.profile.skills')} ({t('dashboard.profile.skillsSeparator')})
            </label>
            <input
              id="profile-skills"
              type="text"
              value={profileForm.skills}
              onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
              placeholder={t('dashboard.profile.skillsPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('dashboard.profile.equipment')}
            </label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    (profileForm.equipment || []).includes(item)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('dashboard.profile.languages')}
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    (profileForm.languages || []).includes(lang)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="profile-experience" className="block text-sm font-medium text-gray-700">
              {t('dashboard.profile.yearsOfExperience')}
            </label>
            <input
              id="profile-experience"
              type="number"
              min="0"
              max="70"
              value={profileForm.yearsOfExperience}
              onChange={(e) => setProfileForm({ ...profileForm, yearsOfExperience: e.target.value })}
              className="mt-1 block w-24 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
            />
          </div>
          {/* "How to reach you" section moved to Privacy tab (ContactPrivacySection) */}

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {t('dashboard.profile.howToPayYou')}
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{t('dashboard.profile.defaultPaymentUsdc')}</p>
              <p className="text-xs text-gray-400">{t('dashboard.profile.usdcHint')}</p>
              {hasWallet ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('dashboard.profile.walletConnected')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onScrollToWallets}
                  className="text-sm text-blue-600 hover:text-blue-500 underline"
                >
                  {t('dashboard.profile.connectWalletPrompt')}
                </button>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNonCrypto}
                  onChange={(e) => {
                    setShowNonCrypto(e.target.checked);
                    if (!e.target.checked) {
                      setProfileForm({ ...profileForm, paymentMethods: '' });
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('dashboard.profile.alsoAcceptNonCrypto')}</span>
              </label>
              {showNonCrypto && (
                <div>
                  <label htmlFor="profile-payment-methods" className="block text-sm font-medium text-gray-700">
                    {t('dashboard.profile.paymentMethods')}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">{t('dashboard.profile.paymentMethodsHelp')}</p>
                  <textarea
                    id="profile-payment-methods"
                    value={profileForm.paymentMethods}
                    onChange={(e) => setProfileForm({ ...profileForm, paymentMethods: e.target.value })}
                    placeholder={t('dashboard.profile.paymentMethodsPlaceholder')}
                    rows={2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {t('dashboard.profile.socialProfiles')} ({t('dashboard.profile.socialForTrust')})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-linkedin" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.linkedin')}</label>
                <input
                  id="profile-linkedin"
                  type="url"
                  value={profileForm.linkedinUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  readOnly={!!profile.linkedinVerified}
                  className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md${profile.linkedinVerified ? ' bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {profile.linkedinVerified && (
                  <p className="mt-1 text-xs text-gray-500">{t('dashboard.profile.disconnectToEdit', 'Disconnect to edit')}</p>
                )}
                <input
                  type="number"
                  min="0"
                  value={profileForm.linkedinFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, linkedinFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-twitter" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.twitter')}</label>
                <input
                  id="profile-twitter"
                  type="url"
                  value={profileForm.twitterUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, twitterUrl: e.target.value })}
                  placeholder="https://twitter.com/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  min="0"
                  value={profileForm.twitterFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, twitterFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-github" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.github')}</label>
                <input
                  id="profile-github"
                  type="url"
                  value={profileForm.githubUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  readOnly={!!profile.githubVerified}
                  className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md${profile.githubVerified ? ' bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {profile.githubVerified && (
                  <p className="mt-1 text-xs text-gray-500">{t('dashboard.profile.disconnectToEdit', 'Disconnect to edit')}</p>
                )}
              </div>
              <div>
                <label htmlFor="profile-facebook" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.facebook')}</label>
                <input
                  id="profile-facebook"
                  type="url"
                  value={profileForm.facebookUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, facebookUrl: e.target.value })}
                  placeholder="https://facebook.com/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  min="0"
                  value={profileForm.facebookFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, facebookFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-instagram" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.instagram')}</label>
                <input
                  id="profile-instagram"
                  type="url"
                  value={profileForm.instagramUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, instagramUrl: e.target.value })}
                  placeholder="https://instagram.com/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  min="0"
                  value={profileForm.instagramFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, instagramFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-youtube" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.youtube')}</label>
                <input
                  id="profile-youtube"
                  type="url"
                  value={profileForm.youtubeUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, youtubeUrl: e.target.value })}
                  placeholder="https://youtube.com/@channel"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  min="0"
                  value={profileForm.youtubeFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, youtubeFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-tiktok" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.tiktok', 'TikTok')}</label>
                <input
                  id="profile-tiktok"
                  type="url"
                  value={profileForm.tiktokUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, tiktokUrl: e.target.value })}
                  placeholder="https://tiktok.com/@username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="number"
                  min="0"
                  value={profileForm.tiktokFollowers}
                  onChange={(e) => setProfileForm({ ...profileForm, tiktokFollowers: e.target.value })}
                  placeholder={t('dashboard.profile.followers', 'Followers')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-website" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.website')}</label>
                <input
                  id="profile-website"
                  type="url"
                  value={profileForm.websiteUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Sticky bar with auto-save status */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                onSaveProfile();
              }}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              {t('common.done')}
            </button>
            <div className="flex items-center gap-3">
              {autoSaving && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('dashboard.profile.saving')}
                </span>
              )}
              {!autoSaving && !saving && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('dashboard.profile.saved')}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        (() => {
          const hasSocial = profile.linkedinUrl || profile.twitterUrl || profile.githubUrl ||
            profile.facebookUrl || profile.instagramUrl || profile.youtubeUrl || profile.tiktokUrl || profile.websiteUrl;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* About Card */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t('dashboard.profile.bio')}
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">{t('common.name')}:</span>{' '}
                    <span className="text-gray-900">{profile.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('dashboard.profile.username')}:</span>{' '}
                    {profile.username
                      ? <span className="text-gray-900">@{profile.username}</span>
                      : <span className="text-gray-400 italic">{t('common.notSet')}</span>}
                  </div>
                  <div>
                    <span className="text-gray-500">{t('dashboard.profile.bio')}:</span>{' '}
                    {profile.bio
                      ? <span className="text-gray-900">{profile.bio}</span>
                      : <span className="text-gray-400 italic">{t('common.notSet')}</span>}
                  </div>
                  <div>
                    <span className="text-gray-500">{t('dashboard.profile.location')}:</span>{' '}
                    {profile.location
                      ? <span className="text-gray-900">
                          {profile.locationGranularity === 'neighborhood' && profile.neighborhood
                            ? `${profile.neighborhood}, ${profile.location}`
                            : profile.location}
                        </span>
                      : <span className="text-gray-400 italic">{t('common.notSet')}</span>}
                  </div>
                </div>
              </div>

              {/* Contact & Payment Card */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t('dashboard.profile.howToPayYou')}
                </h3>
                <div className="space-y-2 text-sm">
                  {hasWallet && (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('dashboard.profile.usdcWalletConnected')}
                      </span>
                    </div>
                  )}
                  {profile.paymentMethods && (
                    <div>
                      <span className="text-gray-500">{t('dashboard.profile.paymentMethods')}:</span>{' '}
                      <span className="text-gray-900">{profile.paymentMethods}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills & Equipment Card */}
              <div className={`bg-gray-50 rounded-lg p-4${!hasSocial ? ' md:col-span-2' : ''}`}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t('dashboard.profile.skills')} & {t('dashboard.profile.equipment')}
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">{t('dashboard.profile.skills')}</span>
                    {profile.skills && profile.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile.skills.map((skill) => (
                          <span key={skill} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic mt-1">{t('common.none')}</p>
                    )}
                  </div>
                  {profile.equipment && profile.equipment.length > 0 && (
                    <div>
                      <span className="text-gray-500 text-xs">{t('dashboard.profile.equipment')}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile.equipment.map((item) => (
                          <span key={item} className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.languages && profile.languages.length > 0 && (
                    <div>
                      <span className="text-gray-500 text-xs">{t('dashboard.profile.languages')}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile.languages.map((lang) => (
                          <span key={lang} className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.yearsOfExperience != null && profile.yearsOfExperience > 0 && (
                    <div>
                      <span className="text-gray-500 text-xs">{t('dashboard.profile.yearsOfExperience')}</span>
                      <p className="text-sm text-gray-900 mt-1">
                        {profile.yearsOfExperience} {profile.yearsOfExperience === 1 ? t('common.year') : t('common.years')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Card */}
              {hasSocial && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {t('dashboard.profile.socialProfiles')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.linkedinUrl && (
                      <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                        {t('dashboard.profile.linkedin')}
                        {profile.linkedinFollowers != null && <span className="font-medium">{profile.linkedinFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.twitterUrl && (
                      <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs hover:bg-sky-200">
                        {t('dashboard.profile.twitter')}
                        {profile.twitterFollowers != null && <span className="font-medium">{profile.twitterFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.githubUrl && (
                      <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">
                        {t('dashboard.profile.github')}
                      </a>
                    )}
                    {profile.facebookUrl && (
                      <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                        {t('dashboard.profile.facebook')}
                        {profile.facebookFollowers != null && <span className="font-medium">{profile.facebookFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.instagramUrl && (
                      <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs hover:bg-pink-200">
                        {t('dashboard.profile.instagram')}
                        {profile.instagramFollowers != null && <span className="font-medium">{profile.instagramFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.youtubeUrl && (
                      <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                        {t('dashboard.profile.youtube')}
                        {profile.youtubeFollowers != null && <span className="font-medium">{profile.youtubeFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.tiktokUrl && (
                      <a href={profile.tiktokUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900 text-white rounded text-xs hover:bg-gray-800">
                        {t('dashboard.profile.tiktok', 'TikTok')}
                        {profile.tiktokFollowers != null && <span className="font-medium">{profile.tiktokFollowers.toLocaleString()}</span>}
                      </a>
                    )}
                    {profile.websiteUrl && (
                      <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                        {t('dashboard.profile.website')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
