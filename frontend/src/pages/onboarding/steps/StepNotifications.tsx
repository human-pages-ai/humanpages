import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

interface StepNotificationsProps {
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepNotifications({
  onNext,
  onSkip,
  error,
}: StepNotificationsProps) {
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');

  // Check if notifications are already enabled
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      }
    }
  }, []);

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

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Enable Notifications</h2>
      <p className="text-slate-600 mb-6">Get discovered faster by agents who need your skills</p>

      {(error || registrationError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">
          {error || registrationError}
        </div>
      )}

      {/* Urgency banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Agents are more likely to hire you if you respond quickly</p>
            <p className="text-xs text-amber-700 mt-1">Push notifications alert you instantly when agents want to work with you.</p>
          </div>
        </div>
      </div>

      {/* Notification section */}
      <div className="mb-6 p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Push Notifications</h3>
            <p className="text-xs text-slate-500">Instant alerts on your device</p>
          </div>
          {notificationStatus === 'granted' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Enabled
            </span>
          )}
        </div>

        {notificationStatus === 'granted' ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">Push notifications are enabled! You'll receive instant alerts when agents want to hire you.</p>
        ) : notificationStatus === 'denied' ? (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">You've declined push notifications. You can enable them anytime in your browser settings.</p>
        ) : (
          <button
            type="button"
            onClick={handleEnablePushNotifications}
            disabled={isRegistering}
            className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {isRegistering ? 'Enabling...' : 'Enable Push Notifications'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Next →</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip →</button>
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
