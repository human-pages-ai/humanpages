import { useTranslation } from 'react-i18next';

interface Props {
  isAvailable: boolean;
  saving: boolean;
  onToggle: () => void;
}

export default function AvailabilitySection({ isAvailable, saving, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
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
    </div>
  );
}
