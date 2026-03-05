import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect project ID — get one free at https://cloud.walletconnect.com/
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  connectors: [
    // Browser extensions (MetaMask, Coinbase, etc. when installed as extension)
    injected(),
    // WalletConnect protocol — handles ALL mobile wallets (MetaMask, Coinbase,
    // Trust, Rainbow, etc.) via deep link + callback without leaving the browser.
    // We intentionally omit the native coinbaseWallet() connector because its
    // deep-link handshake is broken on Android — it opens the app but never
    // sends the connection request back.
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: false, // ConnectKit handles the modal UI
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});
