/**
 * VerificationSection — Dashboard section showing all verification methods
 *
 * Consolidates LinkedIn, GitHub, and Humanity verification into one clean section
 * with trust score display and progressive disclosure.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { Profile } from './types';
import TrustBadge from '../TrustBadge';
import { safeSessionStorage } from '../../lib/safeStorage';

interface VerificationSectionProps {
  profile: Profile;
  onProfileUpdate: () => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function VerificationItem({
  title,
  description,
  isVerified,
  verifiedLabel,
  onConnect,
  onDisconnect,
  connecting,
  icon,
  color,
}: {
  title: string;
  description: string;
  isVerified: boolean;
  verifiedLabel: string;
  onConnect: () => void;
  onDisconnect?: () => void;
  connecting: boolean;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            {isVerified && (
              <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                <CheckIcon className="w-3.5 h-3.5" />
                {verifiedLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div>
        {isVerified ? (
          onDisconnect && (
            <button
              onClick={onDisconnect}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Disconnect
            </button>
          )
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {connecting ? (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <LinkIcon className="w-3 h-3" />
            )}
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerificationSection({ profile, onProfileUpdate }: VerificationSectionProps) {
  const [connectingLinkedin, setConnectingLinkedin] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);

  const handleConnectLinkedin = async () => {
    setConnectingLinkedin(true);
    try {
      const { url, state } = await api.getLinkedInVerifyUrl();
      safeSessionStorage.setItem('linkedin_verify_state', state);
      window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect LinkedIn');
      setConnectingLinkedin(false);
    }
  };

  const handleDisconnectLinkedin = async () => {
    try {
      await api.disconnectLinkedin();
      toast.success('LinkedIn disconnected');
      onProfileUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect LinkedIn');
    }
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    try {
      const { url, state } = await api.getGitHubVerifyUrl();
      safeSessionStorage.setItem('github_verify_state', state);
      window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect GitHub');
      setConnectingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    try {
      await api.disconnectGithub();
      toast.success('GitHub disconnected');
      onProfileUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect GitHub');
    }
  };

  const verifiedCount = [
    profile.emailVerified,
    profile.linkedinVerified,
    profile.githubVerified,
    profile.humanityVerified,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Boost Your Profile
        </h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {verifiedCount}/4 verified
        </span>
      </div>

      {/* Trust score display */}
      {profile.trustScore && (
        <div className="mb-4">
          <TrustBadge
            trustScore={profile.trustScore}
            linkedinVerified={profile.linkedinVerified}
            githubVerified={profile.githubVerified}
            githubUsername={profile.githubUsername}
            humanityVerified={profile.humanityVerified}
            humanityScore={profile.humanityScore}
          />
        </div>
      )}

      {/* Verification items */}
      <div className="space-y-2">
        {/* Email — always shown as verified since account requires it */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Email</span>
                {profile.emailVerified && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Basic identity verification</p>
            </div>
          </div>
        </div>

        {/* LinkedIn */}
        <VerificationItem
          title="LinkedIn"
          description="Stand out to agents hiring for professional tasks"
          isVerified={!!profile.linkedinVerified}
          verifiedLabel="Connected"
          onConnect={handleConnectLinkedin}
          onDisconnect={handleDisconnectLinkedin}
          connecting={connectingLinkedin}
          color="bg-blue-100"
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          }
        />

        {/* GitHub */}
        <VerificationItem
          title="GitHub"
          description="Get matched with technical and developer tasks"
          isVerified={!!profile.githubVerified}
          verifiedLabel={profile.githubUsername ? `@${profile.githubUsername}` : 'Connected'}
          onConnect={handleConnectGithub}
          onDisconnect={handleDisconnectGithub}
          connecting={connectingGithub}
          color="bg-gray-800"
          icon={
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          }
        />
      </div>

      {/* Tip */}
      {verifiedCount < 3 && (
        <p className="mt-4 text-xs text-gray-500">
          Verified profiles get up to 3x more job offers. Each connection you add increases your visibility to AI agents looking for trustworthy humans.
        </p>
      )}
    </div>
  );
}
