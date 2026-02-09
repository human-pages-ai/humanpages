import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from './types';

interface Props {
  profile: Profile;
  onDeleteAccount: (password?: string) => void;
  onExportData: () => void;
  saving: boolean;
}

export default function AccountSection({ profile, onDeleteAccount, onExportData, saving }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleDelete = () => {
    onDeleteAccount(profile.hasPassword ? deletePassword : undefined);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 sm:px-6 text-left"
      >
        <span className="text-sm font-medium text-gray-500">{t('dashboard.account.dangerZone')}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
          {/* Export Data */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900">{t('dashboard.account.exportTitle')}</h3>
            <p className="text-sm text-gray-600 mt-1">{t('dashboard.account.exportDesc')}</p>
            <button
              onClick={onExportData}
              disabled={saving}
              className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {t('dashboard.account.exportButton')}
            </button>
          </div>

          {/* Delete Account */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900">{t('dashboard.account.deleteTitle')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.account.deleteDesc')}</p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                {t('dashboard.account.deleteButton')}
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                {profile.hasPassword && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('dashboard.account.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={saving || (profile.hasPassword && !deletePassword)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {t('dashboard.account.confirmDelete')}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
