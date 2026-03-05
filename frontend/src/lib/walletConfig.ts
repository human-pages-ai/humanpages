import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

// WalletConnect project ID — get one free at https://cloud.walletconnect.com/
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [mainnet, base],
    transports: {
      [mainnet.id]: http(),
      [base.id]: http(),
    },
    walletConnectProjectId,
    appName: 'HumanPages',
    appDescription: 'Get paid by AI for real-world tasks',
    appUrl: 'https://humanpages.ai',
    appIcon: 'https://humanpages.ai/favicon.svg',
  }),
);
