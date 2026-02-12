import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Wallet } from './types';

type Step = 'idle' | 'busy';

interface Props {
  wallets: Wallet[];
  saving: boolean;
  onAddWallet: (data: { address: string; signature: string; nonce: string }) => Promise<void>;
  onDeleteWallet: (id: string) => void;
  onUpdateWalletLabel: (address: string, label?: string) => Promise<void>;
}

interface WalletGroup {
  address: string;
  label?: string;
  wallets: Wallet[];
}

export default function WalletsSection({
  wallets,
  saving,
  onAddWallet,
  onDeleteWallet,
  onUpdateWalletLabel,
}: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const [walletDetected, setWalletDetected] = useState(
    typeof window !== 'undefined' && !!window.ethereum
  );

  const isMobileOrInApp = useMemo(() =>
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(navigator.userAgent),
  []);

  const deepLinks = useMemo(() => {
    const url = window.location.href;
    const hostAndPath = window.location.host + window.location.pathname + window.location.search;
    return {
      metamask: `https://metamask.app.link/dapp/${hostAndPath}`,
      coinbase: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setWalletDetected(!!window.ethereum);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Group wallets by address
  const walletGroups = useMemo<WalletGroup[]>(() => {
    const groups = new Map<string, WalletGroup>();
    for (const wallet of wallets) {
      const key = wallet.address.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { address: wallet.address, label: wallet.label, wallets: [] });
      }
      groups.get(key)!.wallets.push(wallet);
    }
    return Array.from(groups.values());
  }, [wallets]);

  const resetState = () => {
    setStep('idle');
    setError('');
    setBusyMessage('');
  };

  const connectAndVerify = async () => {
    if (!window.ethereum) return;
    setError('');

    // Step 1: Connect wallet
    setBusyMessage(t('dashboard.wallets.connecting'));
    setStep('busy');
    let address: string;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length === 0) {
        setError(t('dashboard.wallets.connectionFailed'));
        setStep('idle');
        return;
      }
      address = accounts[0];
    } catch (err: any) {
      if (err?.code === 4001) {
        setError(t('dashboard.wallets.connectionRejected'));
      } else {
        setError(t('dashboard.wallets.connectionFailed'));
      }
      setStep('idle');
      return;
    }

    // Step 2: Sign to verify ownership
    setBusyMessage(t('dashboard.wallets.signing'));
    try {
      const { nonce, message } = await api.getWalletNonce(address);

      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      }) as string;

      await onAddWallet({
        address,
        signature,
        nonce,
      });

      resetState();
    } catch (err: any) {
      if (err?.code === 4001) {
        setError(t('dashboard.wallets.signatureRejected'));
      } else {
        setError(err?.message || t('dashboard.wallets.verificationFailed'));
      }
      setStep('idle');
    }
  };

  const startEditLabel = (address: string, currentLabel?: string) => {
    setEditingAddress(address);
    setEditLabel(currentLabel || '');
  };

  const saveLabel = async (address: string) => {
    await onUpdateWalletLabel(address, editLabel || undefined);
    setEditingAddress(null);
    setEditLabel('');
  };

  const cancelEditLabel = () => {
    setEditingAddress(null);
    setEditLabel('');
  };

  const networkDisplayName = (network: string): string => {
    const key = `dashboard.wallets.networks.${network}` as const;
    const translated = t(key);
    // If no translation found, capitalize first letter
    return translated !== key ? translated : network.charAt(0).toUpperCase() + network.slice(1);
  };

  const renderNoWallet = () => {
    if (isMobileOrInApp) {
      return (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <p className="text-sm text-gray-700">{t('dashboard.wallets.mobileWalletHint')}</p>
          <a
            href={deepLinks.metamask}
            className="block w-full px-4 py-2 bg-orange-500 text-white text-center rounded-md hover:bg-orange-600"
          >
            {t('dashboard.wallets.openInMetaMask')}
          </a>
          <a
            href={deepLinks.coinbase}
            className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700"
          >
            {t('dashboard.wallets.openInCoinbase')}
          </a>
        </div>
      );
    }
    return (
      <div className="text-xs text-gray-400">
        {t('dashboard.wallets.noWalletExtension')}{' '}
        <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">MetaMask</a>
        {' '}{t('common.or').toLowerCase()}{' '}
        <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">Coinbase Wallet</a>
      </div>
    );
  };

  const renderBusy = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center gap-2">
      <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-gray-700">{busyMessage}</span>
    </div>
  );

  const renderAddButton = () => {
    if (walletDetected) {
      return (
        <button
          onClick={connectAndVerify}
          disabled={saving || step === 'busy'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('dashboard.wallets.addWallet')}
        </button>
      );
    }
    return renderNoWallet();
  };

  return (
    <div id="payment-setup-section" className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">{t('dashboard.wallets.paymentSetupTitle')}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t('dashboard.wallets.paymentSetupSubtitle')}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {step === 'busy' && renderBusy()}

      {walletGroups.length === 0 && step === 'idle' ? (
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.wallets.emptyTitle')}</p>
              <p className="text-sm text-gray-500 mb-2">{t('dashboard.wallets.emptyDescription')}</p>
            </div>
            {renderAddButton()}
          </div>
        </div>
      ) : (
        <>
          {walletGroups.length > 0 && (
            <div className="space-y-3">
              {walletGroups.map((group) => (
                <div key={group.address} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      {editingAddress === group.address ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLabel(group.address);
                              if (e.key === 'Escape') cancelEditLabel();
                            }}
                            placeholder={t('dashboard.wallets.labelPlaceholder')}
                            maxLength={50}
                            className="text-sm px-2 py-1 border border-gray-300 rounded-md flex-1 min-w-0"
                            autoFocus
                          />
                          <button
                            onClick={() => saveLabel(group.address)}
                            className="text-indigo-600 hover:text-indigo-500 text-xs"
                          >
                            {t('common.save')}
                          </button>
                          <button
                            onClick={cancelEditLabel}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {group.label ? (
                            <span className="text-sm text-gray-500">{group.label}</span>
                          ) : null}
                          <button
                            onClick={() => startEditLabel(group.address, group.label)}
                            className="text-gray-400 hover:text-indigo-600"
                            aria-label={group.label ? t('dashboard.wallets.editLabel') : t('dashboard.wallets.addLabel')}
                            title={group.label ? t('dashboard.wallets.editLabel') : t('dashboard.wallets.addLabel')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <p aria-label={t('dashboard.wallets.walletAddress')} className="text-xs text-gray-600 font-mono truncate max-w-md">{group.address}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.wallets.map((wallet) => (
                      <span
                        key={wallet.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
                      >
                        {networkDisplayName(wallet.network)}
                        <button
                          onClick={() => onDeleteWallet(wallet.id)}
                          className="ml-0.5 text-indigo-400 hover:text-red-600"
                          aria-label={`Remove ${wallet.network}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{t('dashboard.wallets.allNetworksNote')}</p>
                </div>
              ))}
            </div>
          )}
          {step === 'idle' && (
            <div className="mt-4">
              {walletDetected ? (
                <button
                  onClick={connectAndVerify}
                  disabled={saving}
                  className="text-indigo-600 hover:text-indigo-500 text-sm"
                >
                  {t('dashboard.wallets.addWallet')}
                </button>
              ) : renderNoWallet()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
