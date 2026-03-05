import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  enabled: boolean;
  saving: boolean;
  onToggle: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function FeaturedInviteModal({ open, enabled, saving, onToggle, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="featured-modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full mx-0 sm:mx-4 p-6">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="text-center mb-5">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </div>
          <h3 id="featured-modal-title" className="text-lg font-semibold text-gray-900">
            {t('dashboard.featuredModal.title', { defaultValue: 'Get featured on our homepage' })}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {t('dashboard.featuredModal.description', { defaultValue: 'Showcase your profile to visitors and AI agents. Featured profiles get more visibility and attract more job offers.' })}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-5">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
            {t('dashboard.featuredModal.whatsShown', { defaultValue: "What's shown" })}
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {['Profile photo', 'Name', 'Skills', 'Location'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors mb-4">
          <span className="text-sm font-medium text-gray-900">
            {t('dashboard.profile.featuredConsent', { defaultValue: 'Feature me on the homepage' })}
          </span>
          {/* Toggle switch */}
          <div className="relative">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="sr-only"
            />
            <div
              onClick={() => onToggle(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </div>
          </div>
        </label>

        <button
          ref={btnRef}
          onClick={onSave}
          disabled={saving}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
        >
          {saving ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' })}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          {t('dashboard.featuredModal.optOut', { defaultValue: 'You can change this anytime in your privacy settings.' })}
        </p>
      </div>
    </div>,
    document.body
  );
}
