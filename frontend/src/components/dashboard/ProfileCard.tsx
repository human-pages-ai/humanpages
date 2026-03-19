import { Link } from 'react-router-dom';
import { Profile } from './types';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {

  // Profile completion scoring
  const checks = [
    { label: 'CV', done: !!profile.cvParsedAt, stepId: 'cv-upload' },
    { label: 'Photo', done: !!profile.profilePhotoUrl, stepId: 'profile' },
    { label: 'Skills', done: (profile.skills?.length || 0) > 0, stepId: 'skills' },
    { label: 'Location', done: !!profile.location?.trim(), stepId: 'location' },
    { label: 'Services', done: profile.services?.some(s => s.isActive) ?? false, stepId: 'services' },
    { label: 'Equipment', done: (profile.equipment?.length || 0) > 0, stepId: 'equipment' },
    { label: 'Payment', done: profile.wallets.length > 0, stepId: 'payment' },
  ];
  // Sort: done first, then not done
  const sortedChecks = [...checks].sort((a, b) => (b.done ? 1 : 0) - (a.done ? 1 : 0));
  const doneCount = checks.filter(c => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const firstIncomplete = checks.find(c => !c.done);
  const ringColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f97316' : '#94a3b8';
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5">
        {/* Progress ring with photo inside */}
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="48" cy="48" r="40" fill="none" stroke={ringColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {profile.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl || ''} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400">
                {profile.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
        </div>

        {/* Name + level + progress */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{profile.name || 'Complete your profile'}</h2>
          {profile.bio && <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{profile.bio}</p>}
          {profile.username && <p className="text-xs text-slate-400">@{profile.username}</p>}
          <p className="mt-2 text-xs text-slate-500">{pct}% complete</p>
          {/* Checklist — clickable items */}
          <div className="mt-3 flex flex-wrap gap-2">
            {sortedChecks.map(c => (
              <Link
                key={c.label}
                to={`/onboarding?step=${c.stepId}`}
                className={`group inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  c.done
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300'
                    : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 hover:shadow-sm'
                }`}
              >
                {c.done ? (
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                )}
                <span>{c.label}</span>
                {!c.done && <svg className="w-3 h-3 text-orange-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        {firstIncomplete && (
          <Link
            to={`/onboarding?step=${firstIncomplete.stepId}`}
            className="w-full sm:w-auto px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 shadow whitespace-nowrap text-center"
          >
            + {firstIncomplete.label}
          </Link>
        )}
      </div>
    </div>
  );
}
