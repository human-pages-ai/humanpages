import { useTranslation } from 'react-i18next';
import { Service } from './types';
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from '../../lib/currencies';

function formatPrice(priceMin?: string | number | null, priceUnit?: string | null, t?: (key: string) => string, priceCurrency?: string): string | null {
  if (!priceMin && priceUnit !== 'NEGOTIABLE') return null;
  if (priceUnit === 'NEGOTIABLE') return t?.('dashboard.services.negotiable') || 'Negotiable';
  if (!priceMin) return null;
  const currency = priceCurrency || 'USD';
  const sym = getCurrencySymbol(currency);
  if (priceUnit === 'HOURLY') return `${sym}${priceMin}/${t?.('dashboard.services.perHourShort') || 'hr'}`;
  if (priceUnit === 'FLAT_TASK') return `${sym}${priceMin}/${t?.('dashboard.services.perTaskShort') || 'task'}`;
  return `${sym}${priceMin}`;
}

interface Props {
  services: Service[];
  showServiceForm: boolean;
  setShowServiceForm: (v: boolean) => void;
  serviceForm: { title: string; description: string; category: string; priceMin: string; priceUnit: string; priceCurrency: string };
  setServiceForm: (v: { title: string; description: string; category: string; priceMin: string; priceUnit: string; priceCurrency: string }) => void;
  saving: boolean;
  onAddService: () => void;
  onToggleServiceActive: (service: Service) => void;
  onDeleteService: (id: string) => void;
}

export default function ServicesSection({
  services,
  showServiceForm,
  setShowServiceForm,
  serviceForm,
  setServiceForm,
  saving,
  onAddService,
  onToggleServiceActive,
  onDeleteService,
}: Props) {
  const { t } = useTranslation();

  return (
    <div id="services-section" className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('dashboard.services.title')}</h2>
        <button
          onClick={() => setShowServiceForm(!showServiceForm)}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          {showServiceForm ? t('common.cancel') : t('dashboard.services.addService')}
        </button>
      </div>

      {showServiceForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label htmlFor="service-title" className="block text-sm font-medium text-gray-700">{t('dashboard.services.serviceTitle')}</label>
            <input
              id="service-title"
              type="text"
              value={serviceForm.title}
              onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
              placeholder={t('dashboard.services.serviceTitlePlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="service-description" className="block text-sm font-medium text-gray-700">{t('dashboard.services.description')}</label>
            <textarea
              id="service-description"
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              rows={3}
              placeholder={t('dashboard.services.descriptionPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="service-category" className="block text-sm font-medium text-gray-700">{t('dashboard.services.category')}</label>
            <input
              id="service-category"
              type="text"
              value={serviceForm.category}
              onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
              placeholder={t('dashboard.services.categoryPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('dashboard.services.price')} ({t('common.optional')})
            </label>
            <div className="mt-1 flex gap-2">
              <select
                id="service-price-currency"
                value={serviceForm.priceCurrency}
                onChange={(e) => setServiceForm({ ...serviceForm, priceCurrency: e.target.value })}
                className="block w-28 px-2 py-2 border border-gray-300 rounded-md bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{getCurrencySymbol(serviceForm.priceCurrency)}</span>
                <input
                  id="service-price-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceForm.priceMin}
                  onChange={(e) => setServiceForm({ ...serviceForm, priceMin: e.target.value })}
                  placeholder={t('dashboard.services.pricePlaceholder')}
                  className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <select
                id="service-price-unit"
                value={serviceForm.priceUnit}
                onChange={(e) => setServiceForm({ ...serviceForm, priceUnit: e.target.value })}
                className="block w-40 px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">{t('dashboard.services.selectUnit')}</option>
                <option value="HOURLY">{t('dashboard.services.perHour')}</option>
                <option value="FLAT_TASK">{t('dashboard.services.perTask')}</option>
                <option value="NEGOTIABLE">{t('dashboard.services.negotiable')}</option>
              </select>
            </div>
          </div>
          <button
            onClick={onAddService}
            disabled={saving || !serviceForm.title || !serviceForm.description || !serviceForm.category}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('dashboard.services.addService')}
          </button>
        </div>
      )}

      {services.length === 0 && !showServiceForm ? (
        <div className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.services.emptyTitle')}</p>
              <p className="text-sm text-gray-500 mb-4">{t('dashboard.services.emptyDescription')}</p>
            </div>
            <button
              onClick={() => setShowServiceForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              {t('dashboard.services.addService')}
            </button>
          </div>
        </div>
      ) : services.length === 0 ? null : (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{service.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{service.category}</span>
                    {formatPrice(service.priceMin, service.priceUnit, t, service.priceCurrency) && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {formatPrice(service.priceMin, service.priceUnit, t, service.priceCurrency)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleServiceActive(service)}
                    aria-pressed={service.isActive}
                    className={`text-xs px-2 py-1 rounded ${
                      service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {service.isActive ? t('dashboard.services.statusActive') : t('dashboard.services.statusInactive')}
                  </button>
                  <button
                    onClick={() => onDeleteService(service.id)}
                    className="text-red-600 hover:text-red-700 text-xs"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!showServiceForm && (
            <button
              onClick={() => setShowServiceForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              + {t('dashboard.services.addAnother')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
