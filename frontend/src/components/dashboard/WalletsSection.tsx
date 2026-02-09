import { useTranslation } from 'react-i18next';
import { Wallet } from './types';

interface Props {
  wallets: Wallet[];
  showWalletForm: boolean;
  setShowWalletForm: (v: boolean) => void;
  walletForm: { network: string; address: string; label: string };
  setWalletForm: (v: { network: string; address: string; label: string }) => void;
  saving: boolean;
  onAddWallet: () => void;
  onDeleteWallet: (id: string) => void;
}

export default function WalletsSection({
  wallets,
  showWalletForm,
  setShowWalletForm,
  walletForm,
  setWalletForm,
  saving,
  onAddWallet,
  onDeleteWallet,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('dashboard.wallets.title')}</h2>
        <button
          onClick={() => setShowWalletForm(!showWalletForm)}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          {showWalletForm ? t('common.cancel') : t('dashboard.wallets.addWallet')}
        </button>
      </div>

      {showWalletForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label htmlFor="wallet-network" className="block text-sm font-medium text-gray-700">{t('dashboard.wallets.network')}</label>
            <select
              id="wallet-network"
              value={walletForm.network}
              onChange={(e) => setWalletForm({ ...walletForm, network: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="ethereum">{t('dashboard.wallets.networks.ethereum')}</option>
              <option value="base">{t('dashboard.wallets.networks.base')}</option>
              <option value="polygon">{t('dashboard.wallets.networks.polygon')}</option>
              <option value="arbitrum">{t('dashboard.wallets.networks.arbitrum')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700">{t('dashboard.wallets.address')}</label>
            <input
              id="wallet-address"
              type="text"
              value={walletForm.address}
              onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="wallet-label" className="block text-sm font-medium text-gray-700">
              {t('dashboard.wallets.label')} ({t('common.optional')})
            </label>
            <input
              id="wallet-label"
              type="text"
              value={walletForm.label}
              onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })}
              placeholder={t('dashboard.wallets.labelPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={onAddWallet}
            disabled={saving || !walletForm.address}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('dashboard.wallets.addWallet')}
          </button>
        </div>
      )}

      {wallets.length === 0 ? (
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.wallets.emptyTitle')}</p>
              <p className="text-sm text-gray-500 mb-2">{t('dashboard.wallets.emptyDescription')}</p>
            </div>
            <button
              onClick={() => setShowWalletForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              {t('dashboard.wallets.addWallet')}
            </button>
            <div className="mt-2 text-xs text-gray-400">
              Don't have a wallet?{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">MetaMask</a>
              {' '}and{' '}
              <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">Coinbase Wallet</a>
              {' '}are popular free options.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-medium text-sm">{wallet.network}</span>
                {wallet.label && <span className="text-gray-500 text-sm ml-2">({wallet.label})</span>}
                <p aria-label={t('dashboard.wallets.walletAddress')} className="text-xs text-gray-600 font-mono truncate max-w-md">{wallet.address}</p>
              </div>
              <button
                onClick={() => onDeleteWallet(wallet.id)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
