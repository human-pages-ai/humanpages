import { useTranslation } from 'react-i18next';

interface Props {
  telegramStatus: { connected: boolean; botAvailable: boolean; botUsername?: string } | null;
  telegramLinkUrl: string | null;
  telegramLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function TelegramSection({
  telegramStatus,
  telegramLinkUrl,
  telegramLoading,
  onConnect,
  onDisconnect,
}: Props) {
  const { t } = useTranslation();

  if (!telegramStatus?.botAvailable) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('dashboard.telegram.title')}</h2>
            <p className="text-gray-600 text-sm">
              {telegramStatus?.connected
                ? t('dashboard.telegram.connected')
                : t('dashboard.telegram.notConnected')}
            </p>
          </div>
        </div>
        {telegramStatus?.connected ? (
          <button
            onClick={onDisconnect}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200"
          >
            {t('dashboard.availability.available')}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={telegramLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-orange-500 disabled:opacity-50"
          >
            {telegramLoading ? t('dashboard.telegram.connecting') : t('dashboard.telegram.connect')}
          </button>
        )}
      </div>
      {telegramLinkUrl && !telegramStatus?.connected && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          {t('dashboard.telegram.openTelegram')}{' '}
          <a href={telegramLinkUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {t('dashboard.telegram.clickHere')}
          </a>
          . {t('dashboard.telegram.waiting')}
        </div>
      )}
    </div>
  );
}
