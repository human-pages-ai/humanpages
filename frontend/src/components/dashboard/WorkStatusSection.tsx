import { useTranslation } from 'react-i18next';

interface Props {
  isAvailable: boolean;
  emailNotifications: boolean;
  telegramNotifications: boolean;
  whatsappNotifications: boolean;
  emailDigestMode: 'REALTIME' | 'HOURLY' | 'DAILY';
  saving: boolean;
  onToggleAvailability: () => void;
  onToggleNotification: (channel: 'email' | 'telegram' | 'whatsapp') => void;
  onEmailDigestModeChange: (mode: 'REALTIME' | 'HOURLY' | 'DAILY') => void;
}

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
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

export default function WorkStatusSection({
  isAvailable,
  emailNotifications,
  telegramNotifications,
  whatsappNotifications,
  emailDigestMode,
  saving,
  onToggleAvailability,
  onToggleNotification,
  onEmailDigestModeChange,
}: Props) {
  const { t } = useTranslation();

  const DIGEST_OPTIONS: { value: 'REALTIME' | 'HOURLY' | 'DAILY'; labelKey: string }[] = [
    { value: 'REALTIME', labelKey: 'dashboard.emailDigest.realtime' },
    { value: 'HOURLY', labelKey: 'dashboard.emailDigest.hourly' },
    { value: 'DAILY', labelKey: 'dashboard.emailDigest.daily' },
  ];

  const channels = [
    { key: 'email' as const, label: t('dashboard.notifications.emailLabel'), desc: t('dashboard.notifications.emailDesc'), enabled: emailNotifications },
    { key: 'telegram' as const, label: t('dashboard.notifications.telegramLabel'), desc: t('dashboard.notifications.telegramDesc'), enabled: telegramNotifications },
    // { key: 'whatsapp' as const, label: t('dashboard.notifications.whatsappLabel'), desc: t('dashboard.notifications.whatsappDesc'), enabled: whatsappNotifications },
  ];

  // Keep whatsappNotifications in scope to avoid unused variable warning
  void whatsappNotifications;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-5">
      {/* Master availability toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('dashboard.workStatus.title')}</h2>
          <p className="text-sm text-gray-600">
            {isAvailable ? t('dashboard.workStatus.activeDesc') : t('dashboard.workStatus.pausedDesc')}
          </p>
        </div>
        <button
          onClick={onToggleAvailability}
          disabled={saving}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isAvailable
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isAvailable ? t('dashboard.workStatus.active') : t('dashboard.workStatus.paused')}
        </button>
      </div>

      {/* Notification channels - only interactive when available */}
      <div className={`pt-4 border-t border-gray-100 ${!isAvailable ? 'opacity-50' : ''}`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('dashboard.workStatus.notifyVia')}</h3>
        {!isAvailable && (
          <p className="text-xs text-gray-400 mb-2">{t('dashboard.workStatus.enableToNotify')}</p>
        )}
        <div className="space-y-3 mt-2">
          {channels.map((ch) => (
            <div key={ch.key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{ch.label}</p>
                <p className="text-xs text-gray-500">{ch.desc}</p>
              </div>
              <Toggle
                enabled={ch.enabled}
                onToggle={() => onToggleNotification(ch.key)}
                disabled={saving || !isAvailable}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Email frequency / digest mode */}
      {emailNotifications && isAvailable && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('dashboard.emailDigest.title')}</h3>
          <p className="text-gray-500 text-xs mb-3">{t('dashboard.emailDigest.subtitle')}</p>
          <div className="flex flex-wrap gap-2">
            {DIGEST_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onEmailDigestModeChange(opt.value)}
                disabled={saving}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  emailDigestMode === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
