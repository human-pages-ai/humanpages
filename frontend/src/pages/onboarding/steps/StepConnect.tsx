import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { isInAppBrowser } from '../utils';
import { WhatsAppSection } from '../components/WhatsAppSection';
import type { TelegramState } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Check if notifications are already enabled and capture beforeinstallprompt event
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      }
    }

    // Capture beforeinstallprompt event for PWA installation
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as BeforeInstallPromptEvent;
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    api.getTelegramStatus().then(status => setTelegramStatus(status)).catch(() => {
      // Initial status check failed — user may not have bot available
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
      setRegistrationError('Push notifications are not supported on this browser');
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
        setRegistrationError('Push notifications are not configured on the server');
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
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Stay Connected</h2>
      <p className="text-slate-600 mb-6">Get notified instantly when agents want to hire you</p>

      {(error || registrationError) && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">{error || registrationError}</div>}

      {/* Urgency banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Agents are more likely to hire you if you respond fast</p>
            <p className="text-xs text-amber-700 mt-1">Enable push notifications and connect Telegram or WhatsApp to receive instant job notifications and never miss an opportunity.</p>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Push Notifications</h3>
            <p className="text-xs text-slate-500">Enable notifications to get discovered faster by agents</p>
          </div>
          {notificationStatus === 'granted' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Enabled
            </span>
          )}
        </div>

        {notificationStatus === 'granted' ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">Push notifications are enabled! You'll receive instant alerts when agents want to hire you.</p>
            <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-blue-900 mb-1">For the best experience, install HumanPages as an app</p>
              <p className="text-xs text-blue-700">In Chrome: Menu → Install app. In Safari: Share → Add to Home Screen.</p>
            </div>
          </div>
        ) : notificationStatus === 'denied' ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">You've declined push notifications. You can enable them anytime in your browser settings.</p>
            <button
              type="button"
              onClick={() => setNotificationStatus('idle')}
              className="w-full py-2.5 bg-slate-500 text-white font-medium rounded-lg hover:bg-slate-600 active:bg-slate-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleEnablePushNotifications}
              disabled={isRegistering}
              className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              {isRegistering ? 'Enabling...' : 'Enable Push Notifications'}
            </button>
            {showInstallButton && (
              <button
                type="button"
                onClick={handleInstallApp}
                className="w-full py-2.5 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 active:bg-purple-700 transition-colors text-sm"
              >
                Install App
              </button>
            )}
            <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-blue-900 mb-1">For the best experience, install HumanPages as an app</p>
              <p className="text-xs text-blue-700">{showInstallButton ? 'Click "Install App" above, or: ' : ''}In Chrome: Menu → Install app. In Safari: Share → Add to Home Screen.</p>
            </div>
          </div>
        )}
      </div>

      {/* Telegram Section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.169.337.015.102.034.331.019.51z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Telegram</h3>
            <p className="text-xs text-slate-500">Receive job offers via our HumanPages bot</p>
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
              {telegramLoading ? 'Connecting...' : 'Connect Telegram'}
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
