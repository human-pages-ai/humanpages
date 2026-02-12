import { useTranslation } from 'react-i18next';

interface Props {
  emailNotifications: boolean;
  telegramNotifications: boolean;
  whatsappNotifications: boolean;
  saving: boolean;
  onToggle: (channel: 'email' | 'telegram' | 'whatsapp') => void;
}

function Toggle({ enabled, onToggle, saving }: { enabled: boolean; onToggle: () => void; saving: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
        enabled ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationPreferencesSection({
  emailNotifications,
  telegramNotifications,
  whatsappNotifications,
  saving,
  onToggle,
}: Props) {
  const { t } = useTranslation();

  const channels = [
    { key: 'email' as const, label: t('dashboard.notifications.emailLabel'), desc: t('dashboard.notifications.emailDesc'), enabled: emailNotifications },
    { key: 'telegram' as const, label: t('dashboard.notifications.telegramLabel'), desc: t('dashboard.notifications.telegramDesc'), enabled: telegramNotifications },
    // { key: 'whatsapp' as const, label: t('dashboard.notifications.whatsappLabel'), desc: t('dashboard.notifications.whatsappDesc'), enabled: whatsappNotifications },
  ];

  // Keep whatsappNotifications in scope to avoid unused variable warning
  void whatsappNotifications;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">{t('dashboard.notifications.title')}</h2>
      <div className="space-y-4">
        {channels.map((ch) => (
          <div key={ch.key} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{ch.label}</p>
              <p className="text-sm text-gray-600">{ch.desc}</p>
            </div>
            <Toggle
              enabled={ch.enabled}
              onToggle={() => onToggle(ch.key)}
              saving={saving}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
