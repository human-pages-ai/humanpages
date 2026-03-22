import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets, getIdentityToken } from '@privy-io/react-auth';
import { isMobile } from '../../../components/dashboard/WalletProvider';
import { extractWalletAddress } from '../../../lib/walletUtils';
import { api } from '../../../lib/api';

interface Props {
  walletAddress: string;
  onWalletConnected: (address: string) => void;
  setError?: (v: string) => void;
}

/**
 * Inner component that uses Privy hooks at the top level (valid hook call).
 * Must be rendered inside a PrivyProvider.
 */
function PrivyWalletConnectInner({ walletAddress, onWalletConnected, setError }: Props) {
  const { t } = useTranslation();
  const { login, authenticated, ready, user: privyUser, logout } = usePrivy();
  const { wallets: privyWallets, ready: walletsReady } = useWallets();
  const handledRef = useRef(false);

  // When Privy authenticates, grab the wallet address, persist it to the Wallet table, and pass it up
  useEffect(() => {
    if (!authenticated || !walletsReady || handledRef.current) return;

    const extracted = extractWalletAddress(privyWallets, privyUser);
    const addr = extracted.address;
    const isPrivy = extracted.isEmbedded;

    if (!addr) return; // Wallets not loaded yet — effect will re-run

    handledRef.current = true;
    onWalletConnected(addr);

    // Persist to Wallet table so the dashboard can see it, then logout.
    // Must get identity token BEFORE logout invalidates the Privy session.
    const source = isPrivy ? 'privy' as const : 'manual_paste' as const;
    (async () => {
      try {
        const idToken = source === 'privy' ? (await getIdentityToken()) || undefined : undefined;
        await api.addWalletManual({ address: addr!, source }, idToken);
      } catch (err: any) {
        // 409/duplicate is fine — wallet already saved
        if (!err?.message?.includes('already')) {
          console.warn('[Onboarding] Failed to persist wallet:', err);
        }
      } finally {
        logout();
      }
    })();
  }, [authenticated, walletsReady, privyWallets, privyUser, onWalletConnected, logout]);

  const handleClick = () => {
    if (setError) setError('');
    handledRef.current = false;
    login();
  };

  const connecting = authenticated && !walletAddress;

  if (walletAddress) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
        <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-green-800">{t('onboarding.payment.crypto.walletConnected', 'Wallet connected')}</p>
          <p className="text-xs text-green-700 font-mono truncate">{walletAddress}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="text-xs text-slate-500 hover:text-slate-700 underline shrink-0"
        >
          {t('onboarding.payment.crypto.changeWallet', 'Change')}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || connecting}
        className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm min-h-[44px]"
      >
        {connecting ? 'Connecting...' : t('onboarding.payment.crypto.connectButton')}
      </button>
      <p className="text-xs text-slate-500 mt-2">{t('onboarding.payment.crypto.connectHint')}</p>
      {isMobile && (
        <p className="text-xs text-amber-600 mt-1">
          On mobile, sign in with email or Google to create a wallet.
        </p>
      )}
    </>
  );
}

export default PrivyWalletConnectInner;
