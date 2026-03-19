import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { isInAppBrowser } from '../utils';
import { WhatsAppSection } from '../components/WhatsAppSection';
import type { TelegramState } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level capture — fires before any component mounts
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
  });
}

interface StepConnectProps {
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
  smsNumber?: string;
  setSmsNumber?: (v: string) => void;
  telegramStatus: TelegramState['telegramStatus'];
  setTelegramStatus: (v: TelegramState['telegramStatus']) => void;
  telegramLinkUrl: string | null;
  setTelegramLinkUrl: (v: string | null) => void;
  telegramLoading: boolean;
  setTelegramLoading: (v: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepConnect({
  whatsappNumber, setWhatsappNumber,
  smsNumber, setSmsNumber,
  telegramStatus, setTelegramStatus,
  telegramLinkUrl, setTelegramLinkUrl,
  telegramLoading, setTelegramLoading,
  onNext, onSkip: _onSkip, error,
}: StepConnectProps) {
  const { t } = useTranslation();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Check if notifications are already enabled and set install button from module-level capture
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      }
    }

    // Check if beforeinstallprompt event was already captured at module level.
    // Note: Chrome suppresses the beforeinstallprompt event when its own banner is shown.
    // If deferredInstallPrompt is null, the install text instructions below will still guide
    // users through the manual installation process (Menu → Install app).
    if (deferredInstallPrompt) {
      installPromptRef.current = deferredInstallPrompt;
      setShowInstallButton(true);
    }

    api.getTelegramStatus().then(status => setTelegramStatus(status)).catch(() => {
      // Initial status check failed — user may not have bot available
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs only on mount to fetch initial telegram status

  const handleInstallApp = async () => {
    if (!installPromptRef.current) return;
    try {
      await installPromptRef.current.prompt();
      const { outcome } = await installPromptRef.current.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      installPromptRef.current = null;
    } catch (err) {
      console.error('Installation prompt failed:', err);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setRegistrationError(t('onboarding.connect.pushNotSupported', 'Push notifications are not supported on this browser'));
      return;
    }

    setNotificationStatus('requesting');
    setRegistrationError('');

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationStatus('denied');
        return;
      }

      setNotificationStatus('granted');

      // Register service worker if not already registered
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch {
        // Service worker not available, but notification permission was granted
        // User can skip this step and enable it later from settings
        return;
      }

      // Get VAPID public key
      const vapidResponse = await api.getVapidPublicKey();
      const vapidPublicKey = vapidResponse.vapidPublicKey;

      if (!vapidPublicKey) {
        setRegistrationError(t('onboarding.connect.pushNotConfigured', 'Push notifications are not configured on the server'));
        return;
      }

      // Subscribe to push notifications
      setIsRegistering(true);
      const uint8Array = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: uint8Array as BufferSource,
      });

      // Send subscription to server
      const endpoint = subscription.endpoint;
      const keys = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!keys || !auth) {
        throw new Error('Failed to get encryption keys from push subscription');
      }

      await api.subscribeToPushNotifications({
        endpoint,
        keys: {
          p256dh: arrayBufferToBase64(keys),
          auth: arrayBufferToBase64(auth),
        },
        userAgent: navigator.userAgent,
      });

      setIsRegistering(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable push notifications';
      setRegistrationError(message);
      setIsRegistering(false);
    }
  };

  const handleConnectTelegram = async () => {
    setTelegramLoading(true);
    try {
      const result = await api.linkTelegram();
      setTelegramLinkUrl(result.linkUrl);
      if (isInAppBrowser()) {
        window.location.href = result.linkUrl;
      } else {
        window.open(result.linkUrl, '_blank');
      }
      // Clear any existing poll before starting a new one
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getTelegramStatus();
          setTelegramStatus(status);
          if (status.connected && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          // Poll attempt failed — will retry in next interval
        }
      }, 3000);
    } catch {
      // Link URL generation failed — will be caught and displayed to user
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">{t('onboarding.connect.heading')}</h2>
      <p className="text-slate-600 mb-6">{t('onboarding.connect.subtitle')}</p>

      {(error || registrationError) && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error || registrationError}</div>}

      {/* Push Notifications — compact */}
      <div className="mb-4 p-4 border border-slate-200 rounded-lg">
        {notificationStatus === 'granted' ? (
          <div className="flex items-center gap-3">
            <span className="text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </span>
            <span className="text-sm text-green-700 flex-1">{t('onboarding.connect.pushEnabled')}</span>
            {showInstallButton && (
              <button type="button" onClick={handleInstallApp} className="text-xs text-purple-600 hover:text-purple-700 font-medium">{t('onboarding.connect.installApp')}</button>
            )}
          </div>
        ) : notificationStatus === 'denied' ? (
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </span>
            <span className="text-sm text-slate-500 flex-1">{t('onboarding.connect.notificationsDenied')}</span>
            <button type="button" onClick={() => setNotificationStatus('idle')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{t('common.tryAgain')}</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </span>
            <span className="text-sm text-slate-700 flex-1">{t('onboarding.connect.pushDescription')}</span>
            <button type="button" onClick={handleEnablePushNotifications} disabled={isRegistering} className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50">
              {isRegistering ? '...' : t('common.enable')}
            </button>
          </div>
        )}
      </div>

      {/* Install hint — always visible since Chrome shows install icon */}
      <p className="mb-4 text-xs text-slate-400 flex items-center gap-1.5">
        <span>📲</span>
        <span>See a <span className="font-medium text-slate-500">⬇ download icon</span> in your address bar? Tap it to install HumanPages as an app.</span>
      </p>

      {/* Telegram Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{t('onboarding.connect.telegram.title')}</h3>
            <p className="text-xs text-slate-500">{t('onboarding.connect.telegram.description')}</p>
          </div>
          {telegramStatus?.connected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Connected
            </span>
          )}
        </div>
        {telegramStatus?.connected ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">You're connected to Telegram! You'll receive instant notifications for new job offers.</p>
        ) : (
          <>
            <button type="button" onClick={handleConnectTelegram} disabled={telegramLoading} className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              {telegramLoading ? t('common.connecting') : t('onboarding.connect.telegram.button')}
            </button>
            {telegramLinkUrl && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p>Didn't open? <a href={telegramLinkUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium" onClick={(e) => { if (isInAppBrowser()) { e.preventDefault(); window.location.href = telegramLinkUrl!; } }}>Click here to connect on Telegram</a>.</p>
                <p className="mt-1">After clicking <strong>Start</strong> in Telegram, we'll detect the connection automatically. {window.location.hostname === 'localhost' && <span className="text-blue-500">(Note: auto-detection requires a public URL — in local dev, deploy or use a tunnel like ngrok.)</span>}</p>
                {window.location.hostname === 'localhost' && telegramLinkUrl && (
                  <p className="mt-2 pt-2 border-t border-blue-200">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const codeMatch = telegramLinkUrl.match(/start=([A-F0-9]+)/i);
                          if (!codeMatch) {
                            alert('Could not extract code from URL');
                            return;
                          }
                          const code = codeMatch[1];
                          const response = await api.devSimulateTelegramConnection(code);
                          if (response.success) {
                            setTelegramStatus({ connected: true, botAvailable: true });
                          }
                        } catch (err) {
                          alert('Simulation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                        }
                      }}
                      className="underline font-medium hover:text-blue-900"
                    >
                      Simulate Connection (dev mode)
                    </button>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <WhatsAppSection whatsappNumber={whatsappNumber} setWhatsappNumber={setWhatsappNumber} smsNumber={smsNumber} setSmsNumber={setSmsNumber} />

      <div className="flex justify-end mt-6">
        <button type="button" onClick={onNext} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500" aria-label="Next step">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}

// Helper function to convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
