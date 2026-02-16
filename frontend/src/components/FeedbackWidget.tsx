import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChatBubbleLeftEllipsisIcon, XMarkIcon, BugAntIcon, LightBulbIcon, ChatBubbleOvalLeftIcon, PaperClipIcon, TrashIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

// ─── Browser info parser ───
function getBrowserInfo(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('Firefox/')) browser = `Firefox ${ua.split('Firefox/')[1]?.split(' ')[0] || ''}`;
  else if (ua.includes('Edg/')) browser = `Edge ${ua.split('Edg/')[1]?.split(' ')[0] || ''}`;
  else if (ua.includes('Chrome/')) browser = `Chrome ${ua.split('Chrome/')[1]?.split(' ')[0] || ''}`;
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = `Safari ${ua.split('Version/')[1]?.split(' ')[0] || ''}`;

  // OS detection
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = `macOS ${ua.split('Mac OS X ')[1]?.split(')')[0]?.replace(/_/g, '.') || ''}`;
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = `Android ${ua.split('Android ')[1]?.split(';')[0] || ''}`;
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = `iOS ${ua.split('OS ')[1]?.split(' ')[0]?.replace(/_/g, '.') || ''}`;

  return { browser: browser.trim(), os: os.trim() };
}

type FeedbackType = 'FEEDBACK' | 'BUG' | 'FEATURE';

const SENTIMENTS = [
  { value: 1, emoji: '😡', label: 'Very Bad' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Amazing' },
];

interface FeedbackWidgetProps {
  defaultType?: FeedbackType;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function FeedbackWidget({ defaultType, isOpen: controlledOpen, onOpenChange }: FeedbackWidgetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = useCallback((val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  }, [onOpenChange]);

  const [type, setType] = useState<FeedbackType>(defaultType || 'FEEDBACK');
  const [sentiment, setSentiment] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setType(defaultType || 'FEEDBACK');
      setSentiment(null);
      setDescription('');
      setScreenshotData(null);
      setSubmitted(false);
    }
  }, [open, defaultType]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  // Handle clipboard paste for screenshots
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImage(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open]);

  function processImage(file: File) {
    // Compress and resize to max 800px wide for reasonable payload size
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setScreenshotData(compressed);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      const { browser, os } = getBrowserInfo();

      await api.submitFeedback({
        type,
        description: description.trim(),
        sentiment: sentiment ?? undefined,
        pageUrl: window.location.href,
        browser,
        os,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        screenshotData: screenshotData || undefined,
      });

      setSubmitted(true);
      toast.success(t('feedback.thankYou', 'Thanks for your feedback!'));

      // Auto-close after showing success
      setTimeout(() => setOpen(false), 2000);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions = [
    { value: 'FEEDBACK' as FeedbackType, icon: ChatBubbleOvalLeftIcon, label: t('feedback.typeFeedback', 'Feedback'), color: 'blue' },
    { value: 'BUG' as FeedbackType, icon: BugAntIcon, label: t('feedback.typeBug', 'Bug Report'), color: 'red' },
    { value: 'FEATURE' as FeedbackType, icon: LightBulbIcon, label: t('feedback.typeFeature', 'Feature Idea'), color: 'amber' },
  ];

  // ─── Floating button (always visible) ───
  const button = (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2.5 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-200 group"
      aria-label={t('feedback.title', 'Send Feedback')}
      title={t('feedback.title', 'Send Feedback')}
    >
      <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
    </button>
  );

  // ─── Success state ───
  if (open && submitted) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('feedback.submitted', 'Thank you!')}
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            {t('feedback.submittedMessage', "We've received your feedback and will review it soon.")}
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // ─── Modal form ───
  const modal = open ? createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={t('feedback.title', 'Send Feedback')}>
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        ref={modalRef}
        className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-xl z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {t('feedback.title', 'Send Feedback')}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            aria-label={t('common.cancel')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  type === opt.value
                    ? opt.color === 'red'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : opt.color === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sentiment (only for FEEDBACK type) */}
          {type === 'FEEDBACK' && (
            <div className="flex gap-2 justify-center">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentiment(s.value)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    sentiment === s.value
                      ? 'bg-blue-50 scale-110 ring-2 ring-blue-200'
                      : 'hover:bg-gray-50 opacity-60 hover:opacity-100'
                  }`}
                  title={s.label}
                  aria-label={s.label}
                >
                  {s.emoji}
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          <div>
            <textarea
              id="fb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'BUG'
                ? t('feedback.bugDescPlaceholder', 'What went wrong? Include steps to reproduce if you can...')
                : type === 'FEATURE'
                ? t('feedback.featureDescPlaceholder', 'What would you like to see and how would it help?')
                : t('feedback.feedbackDescPlaceholder', 'Your thoughts, suggestions, or praise...')
              }
              rows={4}
              required
              maxLength={5000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              {t('feedback.screenshot', 'Screenshot')}
              <span className="text-gray-400 ml-1">({t('feedback.pasteOrUpload', 'paste or upload')})</span>
            </label>
            {screenshotData ? (
              <div className="relative border border-gray-200 rounded-lg overflow-hidden">
                <img src={screenshotData} alt="Screenshot" className="w-full max-h-40 object-contain bg-gray-50" />
                <button
                  type="button"
                  onClick={() => setScreenshotData(null)}
                  className="absolute top-2 right-2 p-1 bg-white/90 rounded-md shadow-sm hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                  aria-label={t('common.delete')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-2"
              >
                <PaperClipIcon className="w-4 h-4" />
                {t('feedback.addScreenshot', 'Click to upload or paste (⌘V) a screenshot')}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processImage(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Auto-context indicator */}
          <p className="text-[11px] text-gray-400 leading-tight">
            {t('feedback.autoContext', 'We automatically include your browser, OS, and current page URL to help us debug issues.')}
            {user && ` ${t('feedback.loggedInAs', 'Sending as')} ${user.email}`}
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !description.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('feedback.sending', 'Sending...')}
              </>
            ) : (
              t('feedback.send', 'Send Feedback')
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {!open && !controlledOpen && button}
      {modal}
    </>
  );
}
