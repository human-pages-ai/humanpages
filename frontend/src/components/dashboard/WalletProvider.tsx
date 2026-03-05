import { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

const appId = import.meta.env.VITE_PRIVY_APP_ID;
const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function WalletProvider({ children }: { children: ReactNode }) {
  if (!appId || appId.startsWith('<')) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: isMobile ? ['email', 'google'] : ['email', 'wallet', 'google'],
        appearance: {
          theme: 'light',
          accentColor: '#2563EB',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
