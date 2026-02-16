import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { Profile } from './types';

interface HumanitySectionProps {
  profile: Profile;
  onVerified: () => void;
}

function getTier(score?: number): string {
  if (!score || score < 1) return 'none';
  if (score < 20) return 'bronze';
  if (score < 40) return 'silver';
  return 'gold';
}

const tierStyles: Record<string, { bg: string; text: string; label: string }> = {
  bronze: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Bronze' },
  silver: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Silver' },
  gold: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Gold' },
};

export default function HumanitySection({ profile, onVerified }: HumanitySectionProps) {
  const [verifying, setVerifying] = useState(false);

  const tier = getTier(profile.humanityScore ?? undefined);
  const isVerified = profile.humanityVerified;
  const hasWallets = profile.wallets.length > 0;

  const handleVerify = async () => {
    if (!hasWallets) {
      toast.error('Add a wallet to your profile first');
      return;
    }

    const walletAddress = profile.wallets[0].address;
    setVerifying(true);
    try {
      const result = await api.verifyHumanity(walletAddress);
      if (result.humanityVerified) {
        toast.success(`Verified as human! Tier: ${result.humanityTier}`);
      } else {
        toast.success(`Score recorded: ${result.humanityScore}. Collect more stamps to reach Silver tier.`);
      }
      onVerified();
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Verified Human Badge
        </h2>
        {!isVerified && (
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Optional</span>
        )}
      </div>
      {!isVerified && (
        <p className="text-sm text-gray-500 mb-4">Stand out to AI agents by proving you're a real person. This is a confidence boost, not a requirement.</p>
      )}
      {isVerified && <div className="mb-4" />}

      {isVerified && tier !== 'none' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${tierStyles[tier]?.bg || ''} ${tierStyles[tier]?.text || ''}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verified Human ({tierStyles[tier]?.label})
            </span>
            <span className="text-sm text-gray-500">
              Score: {profile.humanityScore?.toFixed(1)}
            </span>
          </div>
          {profile.humanityVerifiedAt && (
            <p className="text-xs text-gray-500">
              Verified {new Date(profile.humanityVerifiedAt).toLocaleDateString()}
              {' via Gitcoin Passport'}
            </p>
          )}
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            {verifying ? 'Checking...' : 'Re-verify score'}
          </button>
        </div>
      ) : profile.humanityScore !== undefined && profile.humanityScore !== null && tier === 'bronze' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${tierStyles.bronze.bg} ${tierStyles.bronze.text}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Human (Bronze)
            </span>
            <span className="text-sm text-gray-500">Score: {profile.humanityScore?.toFixed(1)}</span>
          </div>
          <p className="text-sm text-gray-600">
            Collect more stamps on{' '}
            <a href="https://passport.gitcoin.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline">
              Gitcoin Passport
            </a>
            {' '}to reach Silver (20+) and earn a verified badge.
          </p>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            {verifying ? 'Checking...' : 'Re-check my score'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Verify with{' '}
            <a href="https://passport.gitcoin.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline">
              Gitcoin Passport
            </a>
            {' '}to earn a verified badge on your profile. Collect stamps (social accounts, ENS, etc.) to build your score.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">How it works:</p>
            <p>1. Visit Gitcoin Passport and connect your wallet</p>
            <p>2. Collect stamps (GitHub, Google, ENS, etc.)</p>
            <p>3. Come back and click "Check My Score"</p>
          </div>
          {!hasWallets ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-amber-700">
                You need a crypto wallet to verify. Add one in the Wallets section above first.
              </p>
              <p className="text-xs text-amber-600">
                Don't have a wallet?{' '}
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline font-medium">MetaMask</a>
                {' '}and{' '}
                <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="underline font-medium">Coinbase Wallet</a>
                {' '}are popular free options to get started.
              </p>
            </div>
          ) : (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Check My Score
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
