import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import type { FiatPaymentMethod } from '../../../components/dashboard/types';

interface StepPaymentProps {
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
  setError?: (v: string) => void;
}

const PLATFORM_OPTIONS: { value: string; label: string; placeholder: string }[] = [
  { value: 'PAYPAL', label: 'PayPal', placeholder: 'email@example.com' },
  { value: 'WISE', label: 'Wise', placeholder: 'email@example.com' },
  { value: 'VENMO', label: 'Venmo', placeholder: '@username' },
  { value: 'CASHAPP', label: 'Cash App', placeholder: '$cashtag' },
  { value: 'REVOLUT', label: 'Revolut', placeholder: '@username' },
  { value: 'ZELLE', label: 'Zelle', placeholder: 'email or phone' },
  { value: 'MONZO', label: 'Monzo', placeholder: '@username' },
  { value: 'N26', label: 'N26', placeholder: 'email@example.com' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago', placeholder: 'email or phone' },
];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((p) => [p.value, p.label])
);

export function StepPayment({
  walletAddress,
  setWalletAddress,
  onNext,
  onSkip: _onSkip,
  error,
  setError,
}: StepPaymentProps) {
  const { t } = useTranslation();
  const [connectingPrivy, setConnectingPrivy] = useState(false);

  // Existing fiat payment methods (loaded from API)
  const [methods, setMethods] = useState<FiatPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);

  // Add-method form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlatform, setNewPlatform] = useState(PLATFORM_OPTIONS[0].value);
  const [newHandle, setNewHandle] = useState('');
  const [addingMethod, setAddingMethod] = useState(false);

  // Load existing fiat payment methods on mount
  const loadMethods = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      if (profile.fiatPaymentMethods) {
        setMethods(profile.fiatPaymentMethods);
      }
    } catch {
      // Non-critical — user can still add methods
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleAddMethod = async () => {
    const handle = newHandle.trim();
    if (!handle) {
      if (setError) setError('Please enter your handle or username for this platform.');
      return;
    }
    setAddingMethod(true);
    if (setError) setError('');
    try {
      const added = await api.addFiatPaymentMethod({
        platform: newPlatform,
        handle,
      });
      setMethods((prev) => [...prev, added]);
      setNewPlatform(PLATFORM_OPTIONS[0].value);
      setNewHandle('');
      setShowAddForm(false);
    } catch (err: any) {
      if (setError) setError(err?.message || 'Failed to add payment method. Please try again.');
    } finally {
      setAddingMethod(false);
    }
  };

  const handleRemoveMethod = async (id: string) => {
    try {
      await api.deleteFiatPaymentMethod(id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      if (setError) setError(err?.message || 'Failed to remove payment method.');
    }
  };

  const selectedPlatform = PLATFORM_OPTIONS.find((p) => p.value === newPlatform);

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
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.payment.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.payment.subtitle')}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      {/* Fiat Payment Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{t('onboarding.payment.methodsTitle')}</h3>
            <p className="text-xs text-slate-500">Add your preferred payment methods</p>
          </div>
        </div>

        {/* List of added methods */}
        {!loadingMethods && methods.length > 0 && (
          <div className="space-y-2 mb-3">
            {methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      {PLATFORM_LABELS[method.platform] || method.platform}
                    </span>
                    {method.isPrimary && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 font-mono mt-1 truncate">{method.handle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMethod(method.id)}
                  className="ml-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                  title="Remove"
                  aria-label={`Remove ${PLATFORM_LABELS[method.platform] || method.platform}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {loadingMethods && (
          <div className="py-3 text-center text-sm text-slate-400">Loading payment methods...</div>
        )}

        {/* Add method form */}
        {showAddForm ? (
          <div className="space-y-3 border border-slate-200 rounded-lg p-3">
            <div>
              <label htmlFor="fiat-platform" className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
              <select
                id="fiat-platform"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                disabled={addingMethod}
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fiat-handle" className="block text-sm font-medium text-slate-700 mb-1">
                Handle / Username / Email
              </label>
              <input
                id="fiat-handle"
                type="text"
                value={newHandle}
                onChange={(e) => { setNewHandle(e.target.value); if (setError) setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMethod(); }}
                placeholder={selectedPlatform?.placeholder || 'Your username or email'}
                disabled={addingMethod}
                maxLength={200}
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddMethod}
                disabled={addingMethod || !newHandle.trim()}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {addingMethod ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewHandle(''); if (setError) setError(''); }}
                disabled={addingMethod}
                className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-orange-100">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700">
                {methods.length > 0 ? 'Add another payment method' : 'Add a payment method'}
              </p>
              <p className="text-xs text-slate-500">PayPal, Wise, Venmo, Cash App, Revolut, and more</p>
            </div>
          </button>
        )}

        {methods.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">You can manage these from your dashboard later.</p>
        )}
      </div>

      {/* Crypto Wallet Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm1.348 16.555h-2.696l-.282 1.12H7.43l2.772-10.72h2.528l2.772 10.72h-2.268l-.282-1.12zm-2.416-2.016h1.732l-.864-3.444-.868 3.444zm5.098 3.136h2.696l1.68-7.92c.252-.948.266-1.456.14-1.744h2.212l-1.804 9.664h-2.516l-1.808 0z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{t('onboarding.payment.crypto.title')}</h3>
            <p className="text-xs text-slate-500">{t('onboarding.payment.crypto.subtitle')}</p>
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
            {connectingPrivy ? 'Connecting...' : t('onboarding.payment.crypto.connectButton')}
          </button>
          <p className="text-xs text-slate-500 mt-2">{t('onboarding.payment.crypto.connectHint')}</p>
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-slate-500">{t('onboarding.payment.crypto.divider')}</span>
          </div>
        </div>

        {/* Wallet Address Input */}
        <div>
          <label htmlFor="wallet-address" className="block text-sm font-medium text-slate-700 mb-2">{t('onboarding.payment.crypto.addressLabel')}</label>
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
