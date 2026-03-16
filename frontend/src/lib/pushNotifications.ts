import { safeLocalStorage } from './safeStorage';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    throw new Error('Invalid VAPID key format');
  }
}

async function getVapidKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-key');
  if (!res.ok) throw new Error('Push not configured on server');
  const data = await res.json();
  return data.vapidPublicKey;
}

function getToken(): string | null {
  return safeLocalStorage.getItem('token');
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidKey();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
  });

  const subJson = subscription.toJSON();
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
      userAgent: navigator.userAgent,
    }),
  });

  if (!res.ok) throw new Error('Failed to register push subscription');
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    const token = getToken();

    // Server-first: delete the server record before browser unsubscribe
    // This prevents ghost subscriptions if the browser unsubscribe succeeds
    // but the server call fails
    if (token) {
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint }),
      });
    }

    // Then unsubscribe browser-side
    await subscription.unsubscribe();
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
