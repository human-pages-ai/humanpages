interface StepPaymentProps {
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepPayment({
  walletAddress,
  setWalletAddress,
  onNext,
  onSkip: _onSkip,
  error,
}: StepPaymentProps) {
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
            <h3 className="font-semibold text-slate-900">Fiat Payment</h3>
            <p className="text-xs text-slate-500">International bank transfers</p>
          </div>
        </div>
        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          <p className="font-medium text-slate-700 mb-1">Coming soon</p>
          <p className="text-xs text-slate-600">We're integrating Wise, PayPal, and direct bank transfers. You'll be able to set these up from your dashboard.</p>
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

        {/* Wallet Address Input */}
        <div className="mb-3">
          <label htmlFor="wallet-address" className="block text-sm font-medium text-slate-700 mb-2">Ethereum / Base wallet address</label>
          <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            You can set your wallet address now or connect it later from your dashboard using Privy for a verified connection.
          </p>
          <input
            id="wallet-address"
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value.trim())}
            placeholder="0x..."
            className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
          />
          <p className="text-xs text-slate-500 mt-2">Or paste your wallet address manually. You'll be able to connect via Privy from your dashboard.</p>
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
