import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { isMobile } from '../../../components/dashboard/WalletProvider';

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

  // When Privy authenticates, grab the wallet address and pass it up
  useEffect(() => {
    if (!authenticated || !walletsReady || handledRef.current) return;

    // Try useWallets() first, fall back to linked accounts
    let addr = privyWallets.find((w) => w.walletClientType === 'privy')?.address
      || privyWallets[0]?.address;

    if (!addr && privyUser) {
      const linked = privyUser.linkedAccounts?.find((a: any) => a.type === 'wallet');
      if (linked) addr = (linked as any).address;
    }

    if (!addr) return; // Wallets not loaded yet — effect will re-run

    handledRef.current = true;
    onWalletConnected(addr);
    logout();
  }, [authenticated, walletsReady, privyWallets, privyUser, onWalletConnected, logout]);

  const handleClick = () => {
    if (setError) setError('');
    handledRef.current = false;
    login();
  };

  const connecting = authenticated && !walletAddress;

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
