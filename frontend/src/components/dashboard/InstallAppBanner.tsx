import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { safeLocalStorage } from '../../lib/safeStorage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  hasReceivedOffer: boolean;
}

export default function InstallAppBanner({ hasReceivedOffer }: Props) {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;

  useEffect(() => {
    if (safeLocalStorage.getItem('installBannerDismissed') === 'true') {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Don't show: already installed, already dismissed, no offer received yet, or no prompt available (and not iOS)
  if (isStandalone || dismissed || !hasReceivedOffer) return null;
  if (!deferredPrompt && !isIOS) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'dismissed') {
        handleDismiss();
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    safeLocalStorage.setItem('installBannerDismissed', 'true');
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          {t('dashboard.installApp.title', 'Install HumanPages')}
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          {isIOS
            ? t('dashboard.installApp.iosInstructions', 'In Safari, tap Share then "Add to Home Screen" for instant notifications')
            : t('dashboard.installApp.description', 'Install for instant push notifications and quick access')}
        </p>
      </div>
      {!isIOS && (
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          {t('dashboard.installApp.install', 'Install')}
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="text-blue-400 hover:text-blue-600 text-lg leading-none"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
