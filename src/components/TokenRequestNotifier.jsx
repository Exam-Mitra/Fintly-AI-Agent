import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { watchMyTokenRequests } from '../lib/tokenRequests.js';

const STORAGE_KEY_PREFIX = 'fintly-seen-request-';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function TokenRequestNotifier() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  const shownRef = useRef(new Set());

  useEffect(() => {
    if (!user) return;
    const unsub = watchMyTokenRequests(user.uid, (requests) => {
      const resolved = requests.find((r) => r.status !== 'pending');
      if (!resolved) return;

      const seenKey = `${STORAGE_KEY_PREFIX}${resolved.id}`;
      let alreadySeen = false;
      try {
        alreadySeen = localStorage.getItem(seenKey) === '1';
      } catch {
        alreadySeen = shownRef.current.has(resolved.id);
      }
      if (alreadySeen) return;

      shownRef.current.add(resolved.id);
      try {
        localStorage.setItem(seenKey, '1');
      } catch {
        // non-fatal
      }
      setToast(resolved);
    });
    return unsub;
  }, [user]);

  if (!toast) return null;

  const approved = toast.status === 'approved';

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, maxWidth: 380, width: 'calc(100% - 32px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px',
        background: 'var(--bg-elevated)', border: `1px solid ${approved ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{approved ? '🎉' : 'ℹ️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>
            {approved ? 'Your token request was approved!' : 'Your token request was reviewed'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
            {approved
              ? 'You now have more messages available — check Settings to see your updated balance.'
              : "This request wasn't approved this time. Feel free to submit a new one if you still need more messages."}
          </div>
        </div>
        <button onClick={() => setToast(null)} style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
