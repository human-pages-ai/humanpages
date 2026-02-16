import { useTranslation } from 'react-i18next';

type PaymentPref = 'UPFRONT' | 'ESCROW' | 'UPON_COMPLETION' | 'STREAM';

interface Props {
  isAvailable: boolean;
  paymentPreferences: PaymentPref[];
  saving: boolean;
  onToggle: () => void;
  onPaymentPreferenceToggle: (pref: PaymentPref) => void;
}

export default function AvailabilitySection({
  isAvailable,
  paymentPreferences,
  saving,
  onToggle,
  onPaymentPreferenceToggle,
}: Props) {
  const { t } = useTranslation();

  const PAYMENT_OPTIONS: { value: PaymentPref; labelKey: string }[] = [
    { value: 'UPFRONT', labelKey: 'dashboard.paymentPreference.upfront' },
    { value: 'ESCROW', labelKey: 'dashboard.paymentPreference.escrow' },
    { value: 'UPON_COMPLETION', labelKey: 'dashboard.paymentPreference.upon_completion' },
    { value: 'STREAM', labelKey: 'dashboard.paymentPreference.stream' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('dashboard.availability.title')}</h2>
          <p className="text-gray-600 text-sm">
            {isAvailable ? t('dashboard.availability.visible') : t('dashboard.availability.hidden')}
          </p>
        </div>
        <button
          onClick={onToggle}
          disabled={saving}
          className={`px-4 py-2 rounded-lg font-medium ${
            isAvailable
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isAvailable ? t('dashboard.availability.available') : t('dashboard.availability.unavailable')}
        </button>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.paymentPreference.title')}</h3>
        <p className="text-gray-500 text-xs mb-3">{t('dashboard.paymentPreference.subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPaymentPreferenceToggle(opt.value)}
              disabled={saving}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                paymentPreferences.includes(opt.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
