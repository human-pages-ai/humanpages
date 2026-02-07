import { useTranslation } from 'react-i18next';
import { Profile } from './types';

interface Props {
  profile: Profile;
  editingFilters: boolean;
  setEditingFilters: (v: boolean) => void;
  filtersForm: { minOfferPrice: string; maxOfferDistance: string; minRateUsdc: string };
  setFiltersForm: (v: { minOfferPrice: string; maxOfferDistance: string; minRateUsdc: string }) => void;
  saving: boolean;
  onSaveFilters: () => void;
}

export default function OfferFiltersSection({
  profile,
  editingFilters,
  setEditingFilters,
  filtersForm,
  setFiltersForm,
  saving,
  onSaveFilters,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('dashboard.filters.title')}</h2>
          <p className="text-gray-600 text-sm">{t('dashboard.filters.subtitle')}</p>
        </div>
        <button
          onClick={() => setEditingFilters(!editingFilters)}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          {editingFilters ? t('common.cancel') : t('dashboard.filters.configure')}
        </button>
      </div>

      {editingFilters ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="filter-min-price" className="block text-sm font-medium text-gray-700">{t('dashboard.filters.minPrice')}</label>
            <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.minPriceDesc')}</p>
            <input
              id="filter-min-price"
              type="number"
              min="0"
              step="1"
              value={filtersForm.minOfferPrice}
              onChange={(e) => setFiltersForm({ ...filtersForm, minOfferPrice: e.target.value })}
              placeholder="e.g., 50"
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="filter-min-rate" className="block text-sm font-medium text-gray-700">{t('dashboard.filters.minRate')}</label>
            <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.minRateDesc')}</p>
            <input
              id="filter-min-rate"
              type="number"
              min="0"
              step="1"
              value={filtersForm.minRateUsdc}
              onChange={(e) => setFiltersForm({ ...filtersForm, minRateUsdc: e.target.value })}
              placeholder="e.g., 25"
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="filter-max-distance" className="block text-sm font-medium text-gray-700">{t('dashboard.filters.maxDistance')}</label>
            <p className="text-xs text-gray-500 mb-1">{t('dashboard.filters.maxDistanceDesc')}</p>
            <input
              id="filter-max-distance"
              type="number"
              min="1"
              step="1"
              value={filtersForm.maxOfferDistance}
              onChange={(e) => setFiltersForm({ ...filtersForm, maxOfferDistance: e.target.value })}
              placeholder="e.g., 100"
              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
            />
            {!profile?.locationLat && filtersForm.maxOfferDistance && (
              <p className="text-xs text-amber-600 mt-1">{t('dashboard.filters.distanceWarning')}</p>
            )}
          </div>

          <button
            onClick={onSaveFilters}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('dashboard.profile.saving') : t('dashboard.filters.saveFilters')}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {!profile?.minOfferPrice && !profile?.maxOfferDistance && !profile?.minRateUsdc ? (
            <p className="text-gray-500">{t('dashboard.filters.noFilters')}</p>
          ) : (
            <>
              {profile?.minOfferPrice && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Minimum offer: <strong>${profile.minOfferPrice} USDC</strong></span>
                </div>
              )}
              {profile?.minRateUsdc && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Minimum rate: <strong>${profile.minRateUsdc}/hr</strong></span>
                </div>
              )}
              {profile?.maxOfferDistance && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Max distance: <strong>{profile.maxOfferDistance} km</strong></span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
