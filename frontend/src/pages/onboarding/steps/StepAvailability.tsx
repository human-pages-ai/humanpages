import { useEffect, useRef } from 'react';
import { CompactCvProcessingBar } from '../components/CvProcessingBar';
import { WEEKLY_CAPACITY_OPTIONS, WORK_TYPE_OPTIONS } from '../constants';

interface StepAvailabilityProps {
  timezone: string;
  setTimezone: (v: string) => void;
  weeklyCapacityHours: number | null;
  setWeeklyCapacityHours: (v: number | null) => void;
  responseTimeCommitment: string;
  setResponseTimeCommitment: (v: string) => void;
  workType: string;
  setWorkType: (v: string) => void;
  cvProcessing: boolean;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepAvailability({
  timezone, setTimezone,
  weeklyCapacityHours, setWeeklyCapacityHours,
  workType, setWorkType,
  cvProcessing, onNext, onSkip, error,
}: StepAvailabilityProps) {
  const onNextRef = useRef(onNext);

  // Update ref on each render
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  // Allow Enter key to advance (no text inputs on this step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        onNextRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Availability & Capacity</h2>
      <p className="text-slate-600 mb-6">Help AI agents find you for the right jobs</p>

      {cvProcessing && <CompactCvProcessingBar />}
      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {/* Info banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-xs text-blue-700">AI agents use these fields to match you with tasks that fit your schedule. The more you fill in, the more jobs you'll be matched with.</p>
        </div>
      </div>

      {/* Timezone */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Your Timezone</label>
        <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
          <span className="text-lg" aria-hidden="true">🌍</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">{timezone || 'Not detected'}</p>
            <p className="text-xs text-slate-500">Auto-detected from your browser</p>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detected) setTimezone(detected);
              } catch {
                // Re-detection failed — keep existing value
              }
            }}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Weekly Capacity */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">How many hours can you work per week?</label>
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
          {WEEKLY_CAPACITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWeeklyCapacityHours(weeklyCapacityHours === opt.value ? null : opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition-colors min-h-[44px] ${
                weeklyCapacityHours === opt.value
                  ? 'border-orange-500 bg-orange-50 text-orange-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700'
              }`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Work Type */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">What type of work do you do?</label>
        <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
          {WORK_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWorkType(workType === opt.value ? '' : opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition-colors min-h-[44px] ${
                workType === opt.value
                  ? 'border-orange-500 bg-orange-50 text-orange-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700'
              }`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip for now</button>
        <p className="text-xs text-slate-500 text-center">Step 3 of 7</p>
      </div>
    </>
  );
}
