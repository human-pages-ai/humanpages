/**
 * VerificationSection — Dashboard section showing all verification methods
 *
 * Consolidates LinkedIn, GitHub, and Humanity verification into one clean section
 * with trust score display and progressive disclosure.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    profile.whatsappVerified,
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
          {t('dashboard.boostYourProfile')}
        </h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {verifiedCount}/5 verified
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
        {/* Email verification */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile.emailVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
              <svg className={`w-5 h-5 ${profile.emailVerified ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* WhatsApp verification — hidden until ready for production */}
        <div className="!hidden flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile.whatsappVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
              <svg className={`w-5 h-5 ${profile.whatsappVerified ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">WhatsApp</span>
                {profile.whatsappVerified && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Verify via WhatsApp OTP</p>
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
