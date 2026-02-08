import React from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from './types';
import PhoneInput from '../PhoneInput';
import LocationAutocomplete from '../LocationAutocomplete';

interface Props {
  profile: Profile;
  editingProfile: boolean;
  setEditingProfile: (v: boolean) => void;
  profileForm: {
    name: string;
    bio: string;
    location: string;
    locationLat?: number;
    locationLng?: number;
    skills: string;
    equipment: string[];
    languages: string[];
    contactEmail: string;
    telegram: string;
    whatsapp: string;
    paymentMethods: string;
    hideContact: boolean;
    username?: string;
    linkedinUrl: string;
    twitterUrl: string;
    githubUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    websiteUrl: string;
  };
  setProfileForm: (v: any) => void;
  saving: boolean;
  onSaveProfile: () => void;
}

export default function ProfileSection({
  profile,
  editingProfile,
  setEditingProfile,
  profileForm,
  setProfileForm,
  saving,
  onSaveProfile,
}: Props) {
  const { t } = useTranslation();

  const [usernameError, setUsernameError] = React.useState<string>('');

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
    if (!username) {
      setUsernameError('');
      return true;
    }
    if (username.length < 3 || username.length > 30) {
      setUsernameError(t('dashboard.profile.usernameLength'));
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError(t('dashboard.profile.usernameChars'));
      return false;
    }
    setUsernameError('');
    return true;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('dashboard.profile.title')}</h2>
        <button
          onClick={() => setEditingProfile(!editingProfile)}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          {editingProfile ? t('common.cancel') : t('common.edit')}
        </button>
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
            {usernameError && (
              <p className="mt-1 text-sm text-red-600">{usernameError}</p>
            )}
            {profileForm.username && !usernameError && (
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
              value={profileForm.location}
              onChange={(loc, lat, lng) => {
                setProfileForm({
                  ...profileForm,
                  location: loc,
                  ...(lat != null && lng != null ? { locationLat: lat, locationLng: lng } : {}),
                });
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
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
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-600'
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
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-600'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {t('dashboard.profile.howToReachYou')}
            </h3>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.hideContact}
                onChange={(e) => setProfileForm({ ...profileForm, hideContact: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">{t('dashboard.profile.hideContact')}</span>
                <br />
                <span className="text-gray-500 text-xs">{t('dashboard.profile.hideContactHelp')}</span>
              </span>
            </label>
            <div className="space-y-4">
              <div>
                <label htmlFor="profile-contact-email" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.contactEmail')}</label>
                <input
                  id="profile-contact-email"
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={(e) => setProfileForm({ ...profileForm, contactEmail: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="profile-telegram" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.telegramHandle')}</label>
                <input
                  id="profile-telegram"
                  type="text"
                  value={profileForm.telegram}
                  onChange={(e) => setProfileForm({ ...profileForm, telegram: e.target.value })}
                  placeholder={t('dashboard.profile.telegramPlaceholder')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="profile-whatsapp" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.whatsapp')}</label>
                <PhoneInput
                  id="profile-whatsapp"
                  value={profileForm.whatsapp}
                  onChange={(val) => setProfileForm({ ...profileForm, whatsapp: val })}
                  className="mt-1 w-full"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {t('dashboard.profile.howToPayYou')}
            </h3>
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
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
              </div>
              <div>
                <label htmlFor="profile-github" className="block text-sm font-medium text-gray-700">{t('dashboard.profile.github')}</label>
                <input
                  id="profile-github"
                  type="url"
                  value={profileForm.githubUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
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

          <button
            onClick={onSaveProfile}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('dashboard.profile.saving') : t('dashboard.profile.saveProfile')}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">{t('common.name')}:</span> {profile.name}</p>
          <p><span className="font-medium">{t('dashboard.profile.username')}:</span> {profile.username ? `@${profile.username}` : t('common.notSet')}</p>
          <p><span className="font-medium">{t('dashboard.profile.bio')}:</span> {profile.bio || t('common.notSet')}</p>
          <p><span className="font-medium">{t('dashboard.profile.location')}:</span> {profile.location || t('common.notSet')}</p>
          <p><span className="font-medium">{t('dashboard.profile.skills')}:</span> {profile.skills?.join(', ') || t('common.none')}</p>
          {profile.equipment && profile.equipment.length > 0 && (
            <p><span className="font-medium">{t('dashboard.profile.equipment')}:</span> {profile.equipment.join(', ')}</p>
          )}
          {profile.languages && profile.languages.length > 0 && (
            <p><span className="font-medium">{t('dashboard.profile.languages')}:</span> {profile.languages.join(', ')}</p>
          )}
          <p><span className="font-medium">{t('dashboard.profile.contactEmail')}:</span> {profile.contactEmail || t('common.notSet')}</p>
          <p><span className="font-medium">{t('dashboard.profile.telegramHandle')}:</span> {profile.telegram || t('common.notSet')}</p>
          <p><span className="font-medium">{t('dashboard.profile.whatsapp')}:</span> {profile.whatsapp || t('common.notSet')}</p>
          {profile.paymentMethods && (
            <p><span className="font-medium">{t('dashboard.profile.paymentMethods')}:</span> {profile.paymentMethods}</p>
          )}

          {(profile.linkedinUrl || profile.twitterUrl || profile.githubUrl ||
            profile.instagramUrl || profile.youtubeUrl || profile.websiteUrl) && (
            <div className="pt-3 mt-3 border-t border-gray-200">
              <p className="font-medium mb-2">{t('dashboard.profile.socialProfiles')}:</p>
              <div className="flex flex-wrap gap-2">
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                    {t('dashboard.profile.linkedin')}
                  </a>
                )}
                {profile.twitterUrl && (
                  <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs hover:bg-sky-200">
                    {t('dashboard.profile.twitter')}
                  </a>
                )}
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                    {t('dashboard.profile.github')}
                  </a>
                )}
                {profile.instagramUrl && (
                  <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs hover:bg-pink-200">
                    {t('dashboard.profile.instagram')}
                  </a>
                )}
                {profile.youtubeUrl && (
                  <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                    {t('dashboard.profile.youtube')}
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
      )}
    </div>
  );
}
