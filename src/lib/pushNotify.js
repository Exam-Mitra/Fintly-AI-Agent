import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

// Thin client-side helper that fetches a user's (or every user's) saved
// push subscription object(s) from Firestore and posts them to our
// /api/send-push serverless function, which does the actual delivery using
// our free VAPID keys. Every call is fire-and-forget-safe: a failure here
// (no subscription found, network hiccup, etc.) never blocks whatever
// triggered the notification (e.g. approving a token request still works
// even if the push itself doesn't go through).
async function postToSendPush(subscriptions, { title, body, url }) {
  if (!subscriptions.length) return { sent: 0, failed: 0 };
  try {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions, title, body, url }),
    });
    return res.ok ? await res.json() : { sent: 0, failed: subscriptions.length };
  } catch {
    return { sent: 0, failed: subscriptions.length };
  }
}

export async function sendPushToUser(uid, { title, body, url }) {
  const snap = await getDocs(collection(db, 'users', uid, 'pushSubscriptions'));
  const subscriptions = snap.docs.map((d) => d.data().subscription).filter(Boolean);
  return postToSendPush(subscriptions, { title, body, url });
}

// Admin-only in practice (enforced by Firestore rules on the collection
// group read below) — used for broadcast announcements so every opted-in
// user gets a real notification, not just the in-app banner.
export async function sendPushToAllUsers({ title, body, url }) {
  const snap = await getDocs(collectionGroup(db, 'pushSubscriptions'));
  const subscriptions = snap.docs.map((d) => d.data().subscription).filter(Boolean);
  return postToSendPush(subscriptions, { title, body, url });
}
