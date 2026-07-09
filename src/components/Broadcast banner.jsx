import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { watchBroadcast } from '../lib/broadcast.js';

const STORAGE_KEY = 'fintly-dismissed-broadcast-id';

const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function BroadcastBanner() {
  const { user } = useAuth();
  const [broadcast, setBroadcast] = useState(null);
  const [dismissedId, setDismissedId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user) return;
    const unsub = watchBroadcast(setBroadcast);
    return unsub;
  }, [user]);

  if (!user || !broadcast || !broadcast.message || broadcast.id === dismissedId) return null;

  const handleDismiss = () => {
    setDismissedId(broadcast.id);
    try {
      localStorage.setItem(STORAGE_KEY, broadcast.id);
    } catch {
      // non-fatal
    }
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: 'var(--accent-gradient)', color: '#0F1115',
      padding: '9px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center',
    }}>
      <span>{broadcast.message}</span>
      <button onClick={handleDismiss} style={{ color: '#0F1115', flexShrink: 0, display: 'flex' }}>
        <CloseIcon />
      </button>
    </div>
  );
}
