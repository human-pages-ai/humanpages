import { useTranslation } from 'react-i18next';

type PaymentPref = 'UPFRONT' | 'ESCROW' | 'UPON_COMPLETION' | 'STREAM';

interface Props {
  paymentPreferences: PaymentPref[];
  saving: boolean;
  isAvailable: boolean;
  onPaymentPreferenceToggle: (pref: PaymentPref) => void;
}

const PAYMENT_OPTIONS: { value: PaymentPref; labelKey: string; descKey: string }[] = [
  { value: 'UPFRONT', labelKey: 'dashboard.paymentPreference.upfront', descKey: 'dashboard.paymentPreference.upfrontDesc' },
  { value: 'ESCROW', labelKey: 'dashboard.paymentPreference.escrow', descKey: 'dashboard.paymentPreference.escrowDesc' },
  { value: 'UPON_COMPLETION', labelKey: 'dashboard.paymentPreference.upon_completion', descKey: 'dashboard.paymentPreference.upon_completionDesc' },
  { value: 'STREAM', labelKey: 'dashboard.paymentPreference.stream', descKey: 'dashboard.paymentPreference.streamDesc' },
];

export default function PaymentPreferencesSection({
  paymentPreferences,
  saving,
  isAvailable,
  onPaymentPreferenceToggle,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-1">{t('dashboard.paymentPreference.title')}</h2>
      <p className="text-gray-500 text-sm mb-1">{t('dashboard.paymentPreference.subtitle')}</p>
      <p className="text-gray-400 text-xs mb-4">{t('dashboard.paymentPreference.hint')}</p>
      <div className={`space-y-3 ${!isAvailable ? 'opacity-50' : ''}`}>
        {PAYMENT_OPTIONS.map((opt) => {
          const selected = paymentPreferences.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onPaymentPreferenceToggle(opt.value)}
              disabled={saving || !isAvailable}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                selected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                }`}>
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-gray-900'}`}>
                  {t(opt.labelKey)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">{t(opt.descKey)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
