// Vercel serverless — Connections / OAuth scaffold.
// This is the legitimate, ToS-friendly way for Fintly to "log in as the user":
// the USER connects a service via OAuth, and Fintly only acts through that
// service when the user has authorized it AND explicitly confirms each action.
//
// Flow:
//   1. Client GET  /api/connections?provider=google  -> { url } OAuth authorize URL
//      (built from GOOGLE_CLIENT_ID + configured redirect).
//   2. User is sent to that URL, signs in, and is redirected back to
//      /connections?code=... (an SPA route).
//   3. The SPA POSTs { provider, code } here; we exchange the code for tokens using
//      the provider's CLIENT SECRET (a server-side env var the owner must set) and
//      return them. The client stores them in Firestore (user-scoped).
//
// Env vars to set in Vercel for Google:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_BASE (e.g. https://your-app.vercel.app)
// Google must have the redirect URI  <OAUTH_REDIRECT_BASE>/connections  authorized.

const TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes:
      'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
  },
};

function getRedirectUri() {
  const base = (process.env.OAUTH_REDIRECT_BASE || '').replace(/\/$/, '');
  return `${base}/connections`;
}

export async function exchangeTokens(provider, code) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error('unsupported_provider');
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.secretEnv];
  if (!clientId || !clientSecret) throw new Error('oauth_not_configured');

  if (provider === 'google') {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
    });
    const res = await withTimeout(
      fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
      TIMEOUT_MS,
      'oauth'
    );
    if (!res.ok) throw new Error(`token_${res.status}`);
    const data = await res.json();
    if (!data.access_token) throw new Error('no_access_token');
    return {
      ok: true,
      provider,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || null,
      scope: data.scope || '',
    };
  }
  throw new Error('unsupported_provider');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const provider = req.query?.provider || new URL(req.url, 'http://x').searchParams.get('provider');
    const cfg = PROVIDERS[provider];
    if (!cfg) {
      res.status(400).json({ error: 'unsupported_provider' });
      return;
    }
    const clientId = process.env[cfg.clientIdEnv];
    if (!clientId) {
      res.status(200).json({ ok: false, error: 'oauth_not_configured', note: `Set ${cfg.clientIdEnv} in Vercel env.` });
      return;
    }
    const url = `${cfg.authUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
      getRedirectUri()
    )}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(cfg.scopes)}`;
    res.status(200).json({ ok: true, url });
    return;
  }

  if (req.method === 'POST') {
    const { provider, code } = req.body || {};
    if (!provider || !code) {
      res.status(400).json({ error: 'provider and code required' });
      return;
    }
    try {
      const tokens = await exchangeTokens(provider, code);
      res.status(200).json(tokens);
    } catch (e) {
      res.status(200).json({ ok: false, error: e.message || 'oauth_failed' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
