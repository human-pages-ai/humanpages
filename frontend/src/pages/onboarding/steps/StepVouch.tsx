import { useTranslation } from 'react-i18next';
import { VouchCard } from '../../../components/shared/VouchCard';

interface StepVouchProps {
  userId: string;
  username: string;
  setUsername: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepVouch({ userId, username, setUsername, onNext, onSkip: _onSkip, error }: StepVouchProps) {
  const { t } = useTranslation();
  // Username is now auto-generated and set in useProfileForm.loadProfile
  // No need to generate it here, just display what's already set

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.vouch.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.vouch.subtitle')}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error}</div>}

      <VouchCard userId={userId} username={username} onUsernameChange={setUsername} />

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}
