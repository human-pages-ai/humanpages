import { useState } from 'react';

interface StepPaymentProps {
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  fiatPayment?: string;
  setFiatPayment?: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
  setError?: (v: string) => void;
}

const FIAT_PAYMENT_METHODS = [
  'PayPal',
  'Wise',
  'Bank Transfer',
  'Venmo',
  'Cash App',
  'M-Pesa',
  'GCash',
  'Other',
];

export function StepPayment({
  walletAddress,
  setWalletAddress,
  fiatPayment,
  setFiatPayment,
  onNext,
  onSkip: _onSkip,
  error,
  setError,
}: StepPaymentProps) {
  const [connectingPrivy, setConnectingPrivy] = useState(false);
  const [fiatMethod, setFiatMethod] = useState(() => {
    if (fiatPayment) {
      const parts = fiatPayment.split(': ');
      return parts[0] || '';
    }
    return '';
  });
  const [fiatHandle, setFiatHandle] = useState(() => {
    if (fiatPayment) {
      const parts = fiatPayment.split(': ');
      return parts[1] || '';
    }
    return '';
  });

  // Lazy load Privy to avoid impact on 2G networks
  const handleConnectWallet = async () => {
    setConnectingPrivy(true);
    if (setError) setError('');
    try {
      const { usePrivy } = await import('@privy-io/react-auth');
      const usePrivyHook = usePrivy();
      if (usePrivyHook && usePrivyHook.login) {
        usePrivyHook.login();
      } else {
        if (setError) setError('Wallet connection not available. You can paste your address manually below.');
      }
    } catch (err) {
      if (setError) setError('Failed to load wallet connector. Please paste your address manually.');
    } finally {
      setConnectingPrivy(false);
    }
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Get Paid</h2>
      <p className="text-slate-600 mb-6">Set up your payment methods to receive earnings</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Fiat Payment Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Payment Methods</h3>
            <p className="text-xs text-slate-500">Set up your preferred payment method</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="fiat-method" className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select
              id="fiat-method"
              value={fiatMethod}
              onChange={(e) => {
                setFiatMethod(e.target.value);
                if (setFiatPayment && fiatHandle) {
                  setFiatPayment(`${e.target.value}: ${fiatHandle}`);
                }
              }}
              className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Select a payment method...</option>
              {FIAT_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          {fiatMethod && (
            <div>
              <label htmlFor="fiat-handle" className="block text-sm font-medium text-slate-700 mb-1">
                {fiatMethod === 'Bank Transfer' ? 'Account Details' : 'Handle / Username / Email'}
              </label>
              <input
                id="fiat-handle"
                type="text"
                value={fiatHandle}
                onChange={(e) => {
                  setFiatHandle(e.target.value);
                  if (setFiatPayment && fiatMethod) {
                    setFiatPayment(`${fiatMethod}: ${e.target.value}`);
                  }
                }}
                placeholder={fiatMethod === 'Bank Transfer' ? 'IBAN, account number, or details' : `e.g., user@email.com or @username`}
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-1">You can update this later from your dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Crypto Wallet Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm1.348 16.555h-2.696l-.282 1.12H7.43l2.772-10.72h2.528l2.772 10.72h-2.268l-.282-1.12zm-2.416-2.016h1.732l-.864-3.444-.868 3.444zm5.098 3.136h2.696l1.68-7.92c.252-.948.266-1.456.14-1.744h2.212l-1.804 9.664h-2.516l-1.808 0z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Crypto Wallet</h3>
            <p className="text-xs text-slate-500">Receive USDC and ETH</p>
          </div>
        </div>

        {/* Connect Wallet Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={connectingPrivy}
            className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm min-h-[44px]"
          >
            {connectingPrivy ? 'Connecting...' : 'Connect Wallet with Privy'}
          </button>
          <p className="text-xs text-slate-500 mt-2">Click to connect with MetaMask, WalletConnect, email, or create an embedded wallet.</p>
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-slate-500">or paste manually</span>
          </div>
        </div>

        {/* Wallet Address Input */}
        <div>
          <label htmlFor="wallet-address" className="block text-sm font-medium text-slate-700 mb-2">Ethereum / Base wallet address</label>
          <input
            id="wallet-address"
            type="text"
            value={walletAddress}
            onChange={(e) => { setWalletAddress(e.target.value.trim()); if (setError) setError(''); }}
            placeholder="0x..."
            className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
          />
          <p className="text-xs text-slate-500 mt-2">Paste your wallet address to skip connecting with Privy.</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium">You can update these settings anytime</p>
            <p className="text-xs mt-1 text-blue-600">Visit your dashboard to change payment methods or connect additional wallets.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
