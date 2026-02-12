import { useTranslation } from 'react-i18next';
import { Profile } from './types';

interface Props {
  profile: Profile;
  editingProfile: boolean;
  profileForm: {
    contactEmail: string;
    telegram: string;
    hideContact: boolean;
  };
  setProfileForm: (v: any) => void;
}

export default function ContactPrivacySection({
  profile,
  editingProfile,
  profileForm,
  setProfileForm,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-1">{t('dashboard.contactPrivacy.title')}</h2>
      <p className="text-gray-500 text-sm mb-4">{t('dashboard.contactPrivacy.subtitle')}</p>

      {/* Hide contact toggle */}
      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={profileForm.hideContact}
          onChange={(e) => setProfileForm({ ...profileForm, hideContact: e.target.checked })}
          disabled={!editingProfile}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">{t('dashboard.profile.hideContact')}</span>
          <br />
          <span className="text-gray-500 text-xs">{t('dashboard.profile.hideContactHelp')}</span>
        </span>
      </label>

      {/* Contact fields */}
      <div className="space-y-4">
        <div>
          <label htmlFor="privacy-contact-email" className="block text-sm font-medium text-gray-700">
            {t('dashboard.profile.contactEmail')}
          </label>
          {editingProfile ? (
            <input
              id="privacy-contact-email"
              type="email"
              value={profileForm.contactEmail}
              onChange={(e) => setProfileForm({ ...profileForm, contactEmail: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          ) : (
            <p className="mt-1 text-sm text-gray-900">
              {profile.contactEmail || <span className="text-gray-400 italic">{t('common.notSet')}</span>}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="privacy-telegram" className="block text-sm font-medium text-gray-700">
            {t('dashboard.profile.telegramHandle')}
          </label>
          {editingProfile ? (
            <>
              <input
                id="privacy-telegram"
                type="text"
                value={profileForm.telegram}
                onChange={(e) => {
                  let val = e.target.value.trim().replace(/\s/g, '');
                  if (val && !val.startsWith('@')) val = '@' + val;
                  setProfileForm({ ...profileForm, telegram: val });
                }}
                placeholder={t('dashboard.profile.telegramPlaceholder')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {profileForm.telegram && /^@[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/.test(profileForm.telegram) && (
                <a
                  href={`https://t.me/${profileForm.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/>
                  </svg>
                  t.me/{profileForm.telegram.replace('@', '')} - {t('dashboard.profile.verifyLink')}
                </a>
              )}
              {profileForm.telegram && !/^@[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/.test(profileForm.telegram) && profileForm.telegram.length > 1 && (
                <p className="mt-1 text-xs text-red-500">{t('dashboard.profile.invalidTelegram')}</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-900">
              {profile.telegram ? (
                <a href={`https://t.me/${profile.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                  {profile.telegram}
                </a>
              ) : (
                <span className="text-gray-400 italic">{t('common.notSet')}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
