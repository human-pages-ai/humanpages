import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets, getIdentityToken, useCreateWallet } from '@privy-io/react-auth';
import { api } from '../../lib/api';
import { analytics } from '../../lib/analytics';
import { Wallet } from './types';
import { isMobile } from './WalletProvider';

type Step = 'idle' | 'busy';

interface Props {
  wallets: Wallet[];
  saving: boolean;
  onAddWallet: (data: { address: string; signature: string; nonce: string }) => Promise<void>;
  onAddWalletManual: (address: string, source?: 'privy' | 'manual_paste', privyIdToken?: string) => Promise<void>;
  onDeleteWallet: (id: string) => void;
  onUpdateWalletLabel: (address: string, label?: string) => Promise<void>;
}

interface WalletGroup {
  address: string;
  label?: string;
  wallets: Wallet[];
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export default function WalletsSection({
  wallets,
  saving,
  onAddWallet,
  onAddWalletManual,
  onDeleteWallet,
  onUpdateWalletLabel,
}: Props) {
  const { t } = useTranslation();
  const { login, authenticated, ready: privyReady, user: privyUser, logout, exportWallet } = usePrivy();
  const { wallets: privyWallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();

  const [step, setStep] = useState<Step>('idle');
  const [needsWalletCreation, setNeedsWalletCreation] = useState(false);
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualError, setManualError] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  // Track whether we initiated the connect flow so we can auto-verify
  const pendingVerifyRef = useRef(false);

  // Debug logging for Privy state
  useEffect(() => {
    console.log('[Wallets] Privy state:', {
      authenticated,
      privyReady,
      walletsReady,
      pendingVerify: pendingVerifyRef.current,
      privyWalletCount: privyWallets.length,
      privyWallets: privyWallets.map((w) => ({ address: w.address, type: w.walletClientType })),
      privyUserWallets: privyUser?.linkedAccounts?.filter((a: any) => a.type === 'wallet').map((a: any) => a.address),
    });
  }, [authenticated, privyReady, walletsReady, privyWallets, privyUser]);

  // Track whether we already auto-registered a wallet this session
  const autoRegisteredRef = useRef(false);

  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    analytics.track('wallet_section_viewed', {
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

  /** After wallet connects via Privy, verify ownership by signing a nonce. */
  const verifyWallet = useCallback(async (walletAddress: string) => {
    setError('');
    analytics.track('wallet_connect_success');
    setBusyMessage(t('dashboard.wallets.signing'));
    setStep('busy');

    try {
      const privyWallet = privyWallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase(),
      );
      if (!privyWallet) {
        throw new Error('Wallet not found in Privy session');
      }

      const { nonce, message } = await api.getWalletNonce(walletAddress);
      const provider = await privyWallet.getEthereumProvider();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });

      await onAddWallet({ address: walletAddress, signature: signature as string, nonce });
      analytics.track('wallet_connect_success');
      resetState();
      logout();
    } catch (err: any) {
      if (err?.code === 4001 || err?.name === 'UserRejectedRequestError') {
        analytics.track('wallet_sign_rejected');
        setError(t('dashboard.wallets.signatureRejected'));
      } else {
        analytics.track('wallet_sign_failed', { reason: err?.message || 'unknown' });
        setError(err?.message || t('dashboard.wallets.verificationFailed'));
      }
      setStep('idle');
      logout();
    }
  }, [privyWallets, onAddWallet, logout, t]);

  // When Privy authenticates and wallets are ready, auto-register the wallet
  // Handles both: (1) user just clicked connect, (2) existing session from previous page load
  useEffect(() => {
    console.log('[Wallets] Effect check:', {
      authenticated, walletsReady, autoRegistered: autoRegisteredRef.current,
      privyWalletCount: privyWallets.length,
      linkedAccounts: privyUser?.linkedAccounts?.filter((a: any) => a.type === 'wallet').length ?? 0,
    });
    if (!authenticated || !walletsReady || autoRegisteredRef.current) return;

    // Try to get wallet from useWallets() first, fall back to user's linked accounts
    let walletAddress = privyWallets.find((w) => w.walletClientType === 'privy')?.address
      || privyWallets[0]?.address;
    let walletType = privyWallets.find((w) => w.address === walletAddress)?.walletClientType;

    if (!walletAddress && privyUser) {
      const linkedWallet = privyUser.linkedAccounts?.find((a: any) => a.type === 'wallet');
      if (linkedWallet) {
        walletAddress = (linkedWallet as any).address;
        walletType = 'privy';
      }
    }

    if (!walletAddress) {
      console.log('[Wallets] Authenticated but no wallet found yet, privyWallets:', privyWallets.length);
      // Don't set autoRegisteredRef here — the effect will re-run when
      // privyWallets updates with actual wallet data.
      // On mobile with createOnLogin:'off', show opt-in after a delay.
      if (isMobile) {
        setNeedsWalletCreation(true);
      }
      return;
    }

    setNeedsWalletCreation(false);

    // Skip if this wallet is already registered with our backend
    const alreadyRegistered = wallets.some(
      (w) => w.address.toLowerCase() === walletAddress!.toLowerCase(),
    );
    if (alreadyRegistered) {
      console.log('[Wallets] Wallet already registered, cleaning up Privy session');
      autoRegisteredRef.current = true;
      logout();
      return;
    }

    console.log('[Wallets] Wallet detected, registering:', { walletAddress, walletType });
    autoRegisteredRef.current = true;
    pendingVerifyRef.current = false;

    // Embedded wallets (created via email/Google) — verify ownership via Privy identity token
    if (walletType === 'privy') {
      setStep('busy');
      setBusyMessage(t('dashboard.wallets.addingWallet'));
      getIdentityToken()
        .then((idToken) => onAddWalletManual(walletAddress!, 'privy', idToken || undefined))
        .then(() => { resetState(); logout(); })
        .catch((err: any) => {
          setError(err?.message || t('dashboard.wallets.verificationFailed'));
          setStep('idle');
          logout();
        });
    } else {
      // External wallets (MetaMask, Coinbase, etc.) — verify with signature
      verifyWallet(walletAddress);
    }
  }, [authenticated, walletsReady, privyWallets, privyUser, wallets, verifyWallet, onAddWalletManual, logout, t]);

  /** Open Privy modal to connect or create a wallet. */
  const handleConnectWallet = useCallback(async () => {
    setError('');
    analytics.track('wallet_connect_started', { method: 'privy' });
    // Reset refs so the auto-register effect can fire again
    autoRegisteredRef.current = false;
    pendingVerifyRef.current = true;
    if (authenticated) {
      await logout();
      // Wait for Privy state to settle after logout
      await new Promise((r) => setTimeout(r, 500));
    }
    login();
  }, [login, authenticated, logout]);

  /** User opted in to create an embedded wallet on mobile. */
  const handleCreateEmbeddedWallet = useCallback(async () => {
    setError('');
    setStep('busy');
    setBusyMessage(t('dashboard.wallets.addingWallet'));
    analytics.track('wallet_create_embedded', { method: 'privy_mobile' });
    try {
      const wallet = await createWallet();
      setNeedsWalletCreation(false);
      // The auto-register effect will pick up the new wallet
      console.log('[Wallets] Embedded wallet created:', wallet.address);
    } catch (err: any) {
      setError(err?.message || t('dashboard.wallets.verificationFailed'));
      setStep('idle');
    }
  }, [createWallet, t]);

  /** Submit a manually pasted address. */
  const submitManualAddress = async () => {
    const trimmed = manualAddress.trim();
    setManualError('');
    if (!EVM_ADDRESS_RE.test(trimmed)) {
      setManualError(t('dashboard.wallets.invalidAddress'));
      return;
    }
    setStep('busy');
    setBusyMessage(t('dashboard.wallets.addingWallet'));
    try {
      await onAddWalletManual(trimmed, 'manual_paste');
      setManualAddress('');
      resetState();
    } catch (err: any) {
      setError(err?.message || t('dashboard.wallets.verificationFailed'));
      setStep('idle');
    }
  };

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

  /** Render the connect button + manual paste fallback */
  const renderConnectOptions = () => (
    <div className="space-y-3">
      {/* Mobile notice: external wallets not available */}
      {isMobile && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-sm text-amber-800">{t('dashboard.wallets.mobileNotice')}</p>
        </div>
      )}
      {/* After Privy auth on mobile: opt-in to create embedded wallet */}
      {needsWalletCreation ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <p className="text-sm text-blue-900 font-medium">{t('dashboard.wallets.createEmbeddedTitle')}</p>
          <p className="text-sm text-blue-700">{t('dashboard.wallets.createEmbeddedDesc')}</p>
          <div className="flex gap-2">
            <button
              onClick={handleCreateEmbeddedWallet}
              disabled={step === 'busy'}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {t('dashboard.wallets.createEmbeddedButton')}
            </button>
            <button
              onClick={() => { setNeedsWalletCreation(false); logout(); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* Primary: Privy connect/create button */
        <button
          onClick={handleConnectWallet}
          disabled={saving || step === 'busy'}
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{t('dashboard.wallets.connectOrCreate')}</p>
            <p className="text-xs text-gray-500">{t('dashboard.wallets.connectOrCreateDesc')}</p>
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Manual address paste — collapsed by default */}
      <button
        onClick={() => setShowManualPaste(!showManualPaste)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        {showManualPaste ? t('dashboard.wallets.hideManualPaste') : t('dashboard.wallets.showManualPaste')}
      </button>
      {showManualPaste && (
        <div className="border border-gray-200 rounded-lg p-3 mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => { setManualAddress(e.target.value); setManualError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManualAddress(); }}
              placeholder="0x..."
              className="flex-1 min-w-0 text-sm px-3 py-2 border border-gray-300 rounded-md font-mono"
              disabled={saving || step === 'busy'}
            />
            <button
              onClick={submitManualAddress}
              disabled={saving || step === 'busy' || !manualAddress.trim()}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {t('common.add')}
            </button>
          </div>
          {manualError && (
            <p className="text-xs text-red-600 mt-1">{manualError}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{t('dashboard.wallets.pasteAddressNote')}</p>
        </div>
      )}
    </div>
  );

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
        /* ── No wallet yet ── */
        <div className="py-4">
          <div className="flex flex-col items-center gap-4 mb-6">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.wallets.emptyTitle')}</p>
              <p className="text-sm text-gray-500 mb-2">{t('dashboard.wallets.emptyDescription')}</p>
            </div>
          </div>
          {renderConnectOptions()}
        </div>
      ) : (
        /* ── Wallet connected ── */
        <>
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
                    className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {networkDisplayName(wallet.network)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{t('dashboard.wallets.allNetworksNote')}</p>
            </div>
          ))}
          {step === 'idle' && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={exportWallet}
                className="text-xs text-gray-500 hover:text-blue-600 underline"
              >
                {t('dashboard.wallets.exportKey')}
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={() => {
                  // Delete all wallets for all groups, then show connect UI
                  walletGroups.forEach((g) => g.wallets.forEach((w) => onDeleteWallet(w.id)));
                  autoRegisteredRef.current = false;
                }}
                className="text-xs text-gray-500 hover:text-red-500 underline"
              >
                {t('dashboard.wallets.replaceWallet')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
