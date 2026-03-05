import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useModal } from 'connectkit';
import { api } from '../../lib/api';
import { analytics } from '../../lib/analytics';
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
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { setOpen } = useModal();

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Track whether we initiated the connect flow so we can auto-verify
  const pendingVerifyRef = useRef(false);

  const isMobile = useMemo(() =>
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  []);

  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    analytics.track('wallet_section_viewed', {
      wallet_detected: !!window.ethereum,
      is_mobile: isMobile,
      existing_wallets: wallets.length,
    });
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

  /** After wallet connects, verify ownership by signing a nonce. */
  const verifyWallet = useCallback(async (walletAddress: string) => {
    setError('');
    analytics.track('wallet_connect_success');
    setBusyMessage(t('dashboard.wallets.signing'));
    setStep('busy');

    try {
      const { nonce, message } = await api.getWalletNonce(walletAddress);
      const signature = await signMessageAsync({ message });

      await onAddWallet({ address: walletAddress, signature, nonce });
      analytics.track('wallet_connect_success');
      resetState();
      // Disconnect the wagmi session — we only needed the signature
      disconnect();
    } catch (err: any) {
      if (err?.code === 4001 || err?.name === 'UserRejectedRequestError') {
        analytics.track('wallet_sign_rejected');
        setError(t('dashboard.wallets.signatureRejected'));
      } else {
        analytics.track('wallet_sign_failed', { reason: err?.message || 'unknown' });
        setError(err?.message || t('dashboard.wallets.verificationFailed'));
      }
      setStep('idle');
      disconnect();
    }
  }, [signMessageAsync, onAddWallet, disconnect, t]);

  // When a wallet connects and we have a pending verify, auto-start verification
  useEffect(() => {
    if (isConnected && address && pendingVerifyRef.current) {
      pendingVerifyRef.current = false;
      verifyWallet(address);
    }
  }, [isConnected, address, verifyWallet]);

  /** Open the ConnectKit modal. Once connected, verifyWallet runs via the effect above. */
  const startConnect = useCallback(() => {
    setError('');
    analytics.track('wallet_connect_started');
    pendingVerifyRef.current = true;
    setOpen(true);
  }, [setOpen]);

  const startEditLabel = (addr: string, currentLabel?: string) => {
    setEditingAddress(addr);
    setEditLabel(currentLabel || '');
  };

  const saveLabel = async (addr: string) => {
    await onUpdateWalletLabel(addr, editLabel || undefined);
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
    return translated !== key ? translated : network.charAt(0).toUpperCase() + network.slice(1);
  };

  const renderBusy = () => (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center gap-2">
      <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-gray-700">{busyMessage}</span>
    </div>
  );

  const renderConnectButton = (variant: 'primary' | 'link' = 'primary') => {
    if (variant === 'link') {
      return (
        <button
          onClick={startConnect}
          disabled={saving}
          className="text-blue-600 hover:text-blue-500 text-sm"
        >
          {t('dashboard.wallets.addWallet')}
        </button>
      );
    }
    return (
      <button
        onClick={startConnect}
        disabled={saving || step === 'busy'}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {t('dashboard.wallets.connectWallet')}
      </button>
    );
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
            {renderConnectButton()}
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
                            className="text-blue-600 hover:text-blue-500 text-xs"
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
                            className="text-gray-400 hover:text-blue-600"
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {networkDisplayName(wallet.network)}
                        <button
                          onClick={() => onDeleteWallet(wallet.id)}
                          className="ml-0.5 text-blue-400 hover:text-red-600"
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
              {renderConnectButton('link')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
