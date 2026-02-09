import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Wallet } from './types';

type Step = 'idle' | 'connecting' | 'connected' | 'signing';

interface Props {
  wallets: Wallet[];
  saving: boolean;
  onAddWallet: (data: { network: string; address: string; label?: string; signature: string; nonce: string }) => Promise<void>;
  onDeleteWallet: (id: string) => void;
}

export default function WalletsSection({
  wallets,
  saving,
  onAddWallet,
  onDeleteWallet,
}: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('idle');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('ethereum');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const hasWalletExtension = typeof window !== 'undefined' && !!window.ethereum;

  const resetState = () => {
    setStep('idle');
    setAddress('');
    setNetwork('ethereum');
    setLabel('');
    setError('');
  };

  const connectWallet = async () => {
    if (!window.ethereum) return;
    setStep('connecting');
    setError('');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setStep('connected');
      } else {
        setError(t('dashboard.wallets.connectionFailed'));
        setStep('idle');
      }
    } catch (err: any) {
      if (err?.code === 4001) {
        setError(t('dashboard.wallets.connectionRejected'));
      } else {
        setError(t('dashboard.wallets.connectionFailed'));
      }
      setStep('idle');
    }
  };

  const verifyAndAdd = async () => {
    if (!window.ethereum || !address) return;
    setStep('signing');
    setError('');
    try {
      // 1. Get nonce from backend
      const { nonce, message } = await api.getWalletNonce(address);

      // 2. Ask wallet to sign the challenge
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      }) as string;

      // 3. Submit to backend
      await onAddWallet({
        network,
        address,
        label: label || undefined,
        signature,
        nonce,
      });

      resetState();
    } catch (err: any) {
      if (err?.code === 4001) {
        setError(t('dashboard.wallets.signatureRejected'));
        setStep('connected');
      } else {
        setError(err?.message || t('dashboard.wallets.verificationFailed'));
        setStep('connected');
      }
    }
  };

  const renderForm = () => {
    if (!hasWalletExtension) {
      return (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">{t('dashboard.wallets.noWalletExtension')}</p>
          <div className="text-xs text-gray-500">
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">MetaMask</a>
            {' '}{t('common.or').toLowerCase()}{' '}
            <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">Coinbase Wallet</a>
          </div>
        </div>
      );
    }

    if (step === 'idle') {
      return (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">{t('dashboard.wallets.connectDescription')}</p>
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {t('dashboard.wallets.connectWallet')}
          </button>
        </div>
      );
    }

    if (step === 'connecting') {
      return (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-700">{t('dashboard.wallets.connecting')}</span>
        </div>
      );
    }

    if (step === 'connected') {
      return (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500">{t('dashboard.wallets.connectedAs')}</span>
              <p className="text-sm font-mono text-gray-800 truncate max-w-xs">{address}</p>
            </div>
            <button
              onClick={resetState}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {t('dashboard.wallets.changeWallet')}
            </button>
          </div>
          <div>
            <label htmlFor="wallet-network" className="block text-sm font-medium text-gray-700">{t('dashboard.wallets.selectNetwork')}</label>
            <select
              id="wallet-network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="ethereum">{t('dashboard.wallets.networks.ethereum')}</option>
              <option value="base">{t('dashboard.wallets.networks.base')}</option>
              <option value="polygon">{t('dashboard.wallets.networks.polygon')}</option>
              <option value="arbitrum">{t('dashboard.wallets.networks.arbitrum')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="wallet-label" className="block text-sm font-medium text-gray-700">
              {t('dashboard.wallets.label')} ({t('common.optional')})
            </label>
            <input
              id="wallet-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('dashboard.wallets.labelPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={verifyAndAdd}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('dashboard.wallets.verifyAndAdd')}
          </button>
        </div>
      );
    }

    // signing
    return (
      <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center gap-2">
        <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-gray-700">{t('dashboard.wallets.signing')}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('dashboard.wallets.title')}</h2>
        {step !== 'idle' && (
          <button
            onClick={resetState}
            className="text-indigo-600 hover:text-indigo-500 text-sm"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {step !== 'idle' && renderForm()}

      {wallets.length === 0 && step === 'idle' ? (
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">{t('dashboard.wallets.emptyTitle')}</p>
              <p className="text-sm text-gray-500 mb-2">{t('dashboard.wallets.emptyDescription')}</p>
            </div>
            {hasWalletExtension ? (
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {t('dashboard.wallets.connectWallet')}
              </button>
            ) : (
              <div className="text-xs text-gray-400">
                {t('dashboard.wallets.noWalletExtension')}{' '}
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">MetaMask</a>
                {' '}{t('common.or').toLowerCase()}{' '}
                <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">Coinbase Wallet</a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {wallets.length > 0 && (
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{wallet.network}</span>
                    {wallet.label && <span className="text-gray-500 text-sm ml-2">({wallet.label})</span>}
                    <p aria-label={t('dashboard.wallets.walletAddress')} className="text-xs text-gray-600 font-mono truncate max-w-md">{wallet.address}</p>
                  </div>
                  <button
                    onClick={() => onDeleteWallet(wallet.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
          {wallets.length > 0 && step === 'idle' && (
            <button
              onClick={connectWallet}
              className="mt-4 text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {t('dashboard.wallets.addWallet')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
