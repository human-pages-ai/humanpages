import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isInAppBrowser } from '../pages/onboarding/utils';

export default function InAppBrowserBanner() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isInAppBrowser()) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-md text-sm space-y-2">
      <p className="font-medium">{t('auth.inAppBrowserTitle')}</p>
      <p>{t('auth.inAppBrowserDesc')}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-sm font-medium transition-colors"
      >
        {copied ? t('auth.linkCopied') : t('auth.copyLink')}
      </button>
    </div>
  );
}
