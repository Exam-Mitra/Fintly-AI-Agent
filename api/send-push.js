// Vercel serverless function — free tier. Delivers a real Web Push
// notification (works even if the app is fully closed) to one or more
// browser subscription objects, using our own free VAPID key pair — no
// paid Firebase Cloud Messaging tier required.
//
// The caller (client-side, e.g. the Admin Panel approving a token request or
// posting a broadcast) is responsible for fetching the relevant
// subscription object(s) from Firestore first (the client already has the
// right read permissions per our security rules) and posting them here —
// this function has no direct Firestore access of its own, keeping it
// simple and credential-free.
//
// Required environment variables (Vercel -> Project Settings -> Environment Variables):
//   VAPID_PUBLIC_KEY   (same value as VAPID_PUBLIC_KEY hardcoded in src/lib/push.js)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT       e.g. mailto:toolsaayushman@gmail.com

import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { subscriptions, title, body, url } = req.body || {};
  if (!Array.isArray(subscriptions) || !subscriptions.length) {
    res.status(400).json({ error: 'subscriptions array required' });
    return;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    res.status(200).json({ sent: 0, failed: subscriptions.length, error: 'push_not_configured' });
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: title || 'Fintly AI Agent',
    body: body || '',
    url: url || '/',
  });

  const results = await Promise.all(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub, payload).then(
        () => ({ ok: true }),
        (err) => ({ ok: false, statusCode: err?.statusCode })
      )
    )
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  res.status(200).json({ sent, failed });
}
