import { useTranslation } from 'react-i18next';

interface Props {
  emailNotifications: boolean;
  saving: boolean;
  onToggle: () => void;
}

export default function NotificationPreferencesSection({ emailNotifications, saving, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">{t('dashboard.notifications.title')}</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{t('dashboard.notifications.emailLabel')}</p>
          <p className="text-sm text-gray-600">{t('dashboard.notifications.emailDesc')}</p>
        </div>
        <button
          onClick={onToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
            emailNotifications ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={emailNotifications}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              emailNotifications ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
