/**
 * TrustBadge — Unified trust display component
 *
 * Design principles (from research):
 *  - Max 3-4 visible signals (inverted U-curve — more = less trust)
 *  - Progressive disclosure: summary first, details on expand
 *  - Specific > generic ("4.8 rating, 47 jobs" beats "Trusted")
 *  - Placed at decision points, not scattered
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrustScoreData } from './dashboard/types';

interface TrustBadgeProps {
  trustScore?: TrustScoreData;
  linkedinVerified?: boolean;
  githubVerified?: boolean;
  githubUsername?: string;
  humanityVerified?: boolean;
  humanityScore?: number; // kept for future use in detailed breakdown
  reputation?: {
    avgRating: number;
    reviewCount: number;
    jobsCompleted: number;
  };
  vouchCount?: number;
  compact?: boolean; // For search results — show only level badge
  className?: string;
}

const levelConfig = {
  new: {
    label: 'New',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    ring: 'ring-gray-200',
  },
  basic: {
    label: 'Basic',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
  },
  verified: {
    label: 'Verified',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
  trusted: {
    label: 'Trusted',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
  },
} as const;

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Compact badge for search results — shows level + star rating only
 */
function CompactBadge({ trustScore, reputation }: TrustBadgeProps) {
  const level = trustScore?.level || 'new';
  const config = levelConfig[level];

  return (
    <div className="flex items-center gap-2">
      {level !== 'new' && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
          <ShieldIcon className="w-3 h-3" />
          {config.label}
        </span>
      )}
      {reputation && reputation.reviewCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-gray-600">
          <StarIcon className="w-3.5 h-3.5 text-amber-400" />
          {reputation.avgRating.toFixed(1)}
          <span className="text-gray-400">({reputation.reviewCount})</span>
        </span>
      )}
    </div>
  );
}

/**
 * Full trust badge for profile pages
 * Shows: Trust level badge + verified accounts + rating
 * Expandable to show detailed breakdown
 */
export default function TrustBadge({
  trustScore,
  linkedinVerified,
  githubVerified,
  githubUsername,
  humanityVerified,
  humanityScore: _humanityScore,
  reputation,
  vouchCount,
  compact = false,
  className = '',
}: TrustBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return <CompactBadge trustScore={trustScore} reputation={reputation} />;
  }

  const level = trustScore?.level || 'new';
  const config = levelConfig[level];

  // Count verified accounts for the badge row
  const verifiedBadges: Array<{ label: string; color: string }> = [];
  if (linkedinVerified) verifiedBadges.push({ label: 'LinkedIn', color: 'bg-blue-100 text-blue-700' });
  if (githubVerified) verifiedBadges.push({ label: `GitHub${githubUsername ? ` @${githubUsername}` : ''}`, color: 'bg-gray-100 text-gray-700' });
  if (humanityVerified) verifiedBadges.push({ label: 'ID Verified', color: 'bg-purple-100 text-purple-700' });

  return (
    <div className={`${className}`}>
      {/* Primary badge row: Level + Rating + Verified accounts */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Trust level — only shown when trustScore data is available */}
        {trustScore && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} ring-1 ${config.ring}`}>
            <ShieldIcon className="w-4 h-4" />
            {config.label}
          </span>
        )}

        {/* Star rating */}
        {reputation && reputation.reviewCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <StarIcon className="w-4 h-4 text-amber-400" />
            {reputation.avgRating.toFixed(1)}
            <span className="text-xs text-amber-600">({reputation.reviewCount} {reputation.reviewCount === 1 ? 'review' : 'reviews'})</span>
          </span>
        )}

        {/* Vouch count */}
        {vouchCount && vouchCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {vouchCount} {vouchCount === 1 ? 'vouch' : 'vouches'}
          </span>
        )}
      </div>

      {/* Verified accounts row */}
      {verifiedBadges.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {verifiedBadges.map((badge) => (
            <span
              key={badge.label}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
            >
              <CheckCircleIcon className="w-3.5 h-3.5" />
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Expandable breakdown */}
      {trustScore?.breakdown && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? 'Hide details' : 'View trust breakdown'}
        </button>
      )}

      {expanded && trustScore?.breakdown && (
        <TrustBreakdown breakdown={trustScore.breakdown} />
      )}
    </div>
  );
}

function TrustBreakdown({ breakdown }: { breakdown: { identity: number; reputation: number; social: number; activity: number } }) {
  const { t } = useTranslation();

  const categories = [
    { label: 'Identity', value: breakdown.identity, max: 30, descKey: 'trust.breakdown.identityDesc' },
    { label: 'Reputation', value: breakdown.reputation, max: 40, descKey: 'trust.breakdown.reputationDesc' },
    { label: 'Social', value: breakdown.social, max: 15, descKey: 'trust.breakdown.socialDesc' },
    { label: 'Activity', value: breakdown.activity, max: 15, descKey: 'trust.breakdown.activityDesc' },
  ];

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3 text-sm">
      {categories.map((cat) => (
        <TrustBar key={cat.label} label={cat.label} value={cat.value} max={cat.max} description={t(cat.descKey)} />
      ))}
    </div>
  );
}

function TrustBar({ label, value, max, description }: { label: string; value: number; max: number; description?: string }) {
  const pct = Math.round((value / max) * 100);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-xs text-gray-500 shrink-0">{label}</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-12 text-right">{value}/{max}</span>
      </div>
      {description && (
        <p className="text-xs text-gray-400 ml-[5.5rem] mt-0.5">{description}</p>
      )}
    </div>
  );
}

export { CompactBadge };
