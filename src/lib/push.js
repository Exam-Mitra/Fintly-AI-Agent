import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js';

// Real push notifications via the browser's built-in Web Push API — no
// paid Firebase Cloud Messaging tier needed. A subscription is a small
// public-key object the browser gives us once a user grants permission;
// we save it to Firestore, and our serverless function later delivers a
// message to it using our own free VAPID key pair, even if the app/tab is
// completely closed.
//
// Set this to the PUBLIC VAPID key generated for this project (see the
// paired PRIVATE key in the api/send-push.js serverless function's
// VAPID_PRIVATE_KEY environment variable — never expose the private key here).
const VAPID_PUBLIC_KEY = 'BCNL20twVipcfH_ejJ3xyQxbChZxyvSakbXORH4gM23afm1DhVgf7g1JWRwYomi7xEeFgGtlLn-MYcjf7GfX44g';

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscriptionDoc(uid, endpoint) {
  // Keyed by a short hash of the endpoint so a user subscribing from two
  // different devices/browsers gets two separate stored subscriptions
  // (both should receive pushes), instead of overwriting each other.
  const key = endpoint.split('/').pop().slice(-40);
  return doc(db, 'users', uid, 'pushSubscriptions', key);
}

// Asks the browser for notification permission (shows the native prompt),
// then registers a push subscription and saves it to Firestore so our
// server can target this device later. Returns { ok, reason }.
export async function enablePushNotifications(uid) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await setDoc(subscriptionDoc(uid, subscription.endpoint), {
      subscription: subscription.toJSON(),
      updatedAt: Date.now(),
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'subscribe_failed' };
  }
}

export async function disablePushNotifications(uid) {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await deleteDoc(subscriptionDoc(uid, subscription.endpoint));
      await subscription.unsubscribe();
    }
  } catch {
    // non-fatal — worst case a stale subscription lingers server-side and
    // simply gets pruned the next time a push to it fails.
  }
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
