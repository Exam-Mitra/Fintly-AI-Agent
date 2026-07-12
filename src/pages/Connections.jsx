import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    desc: 'Gmail, Calendar, Drive — Fintly can read your data and draft/send only when you confirm.',
  },
];

export default function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const loadStatus = async () => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'connections', 'google');
    const snap = await getDoc(ref);
    setStatus((s) => ({ ...s, google: snap.exists() ? snap.data() : null }));
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle the OAuth redirect back (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const provider = params.get('state') || 'google';
    if (!code || !user) return;
    (async () => {
      setBusy(provider);
      try {
        const res = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, code }),
        });
        const data = await res.json();
        if (!data.access_token) {
          setMsg(data.error || data.note || 'Connection failed.');
          return;
        }
        const ref = doc(db, 'users', user.uid, 'connections', provider);
        await setDoc(
          ref,
          { access_token: data.access_token, refresh_token: data.refresh_token, connectedAt: Date.now() },
          { merge: true }
        );
        setMsg('Google connected.');
        window.history.replaceState({}, '', '/connections');
        loadStatus();
      } catch {
        setMsg('Connection failed.');
      } finally {
        setBusy('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const connect = async (provider) => {
    setBusy(provider);
    try {
      const res = await fetch(`/api/connections?provider=${provider}`);
      const data = await res.json();
      if (!data.ok || !data.url) {
        setMsg(data.note || 'OAuth not configured.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setMsg('Could not start connection.');
    } finally {
      setBusy('');
    }
  };

  const disconnect = async (provider) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'connections', provider);
    await setDoc(ref, { access_token: null, refresh_token: null, connectedAt: null }, { merge: true });
    setMsg('Disconnected.');
    loadStatus();
  };

  return (
    <div className="app-shell">
      <div className="main-area">
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
          <button onClick={() => navigate('/')} style={{ color: 'var(--ink-soft)', marginBottom: 12 }}>
            ← Back
          </button>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Connections</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Connect accounts so Fintly can act on your behalf — always with your explicit confirmation. Each
            connection is stored per-user; disconnect anytime.
          </p>
          {msg && <div style={{ color: 'var(--accent-blue)', fontSize: 13, margin: '8px 0' }}>{msg}</div>}
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10 }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{p.desc}</div>
                {status[p.id]?.access_token ? (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>✅ Connected</div>
                ) : null}
              </div>
              <div style={{ flexShrink: 0 }}>
                {status[p.id]?.access_token ? (
                  <button
                    onClick={() => disconnect(p.id)}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', background: 'var(--surface-2)' }}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => connect(p.id)}
                    disabled={busy === p.id}
                    style={{ fontSize: 13, fontWeight: 700, color: '#0F1115', borderRadius: 10, padding: '8px 14px', background: 'var(--accent-gradient)' }}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
          <p style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 16 }}>
            To enable a provider, set its OAuth credentials in Vercel env (e.g. GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_BASE). See INTEGRATIONS.md.
          </p>
        </div>
      </div>
    </div>
  );
}
