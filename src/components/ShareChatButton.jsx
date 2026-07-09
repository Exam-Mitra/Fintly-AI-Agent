import { useState } from 'react';
import { createSharedChat, buildShareLink } from '../lib/shareChat.js';
import { useAuth } from '../lib/AuthContext.jsx';

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
  </svg>
);
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Publishes a read-only snapshot of the current conversation to a public
// link anyone can view without signing in (see lib/shareChat.js) — a free,
// simple alternative to ChatGPT Plus's "Share" feature. Disabled when the
// chat is empty (nothing to share yet).
export default function ShareChatButton({ title, messages, disabled }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    if (disabled || busy) return;
    setOpen(true);
    if (link) return; // already generated this session — reuse it
    setBusy(true);
    try {
      const shareId = await createSharedChat(user.uid, { title, messages });
      setLink(buildShareLink(shareId));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={disabled}
        title="Share this chat"
        style={{ color: disabled ? 'var(--ink-faint)' : 'var(--ink-soft)', flexShrink: 0, opacity: disabled ? 0.4 : 1 }}
      >
        <ShareIcon />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, background: 'var(--bg-elevated)', borderRadius: '20px 20px 0 0',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>Share this chat</div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--ink-faint)' }}>
                <CloseIcon />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
              Anyone with this link can view a read-only copy of this conversation — no sign-in needed.
              Future messages you send here won't appear on the shared copy unless you re-share.
            </p>

            {busy ? (
              <div style={{ color: 'var(--ink-faint)', fontSize: 13, padding: '10px 0' }}>Generating link…</div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
              }}>
                <span style={{
                  flex: 1, fontSize: 12.5, color: 'var(--ink-soft)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {link}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    fontSize: 12, fontWeight: 700, color: copied ? 'var(--success)' : '#0F1115',
                    padding: '7px 14px', borderRadius: 8, background: copied ? 'var(--surface)' : 'var(--accent-gradient)', flexShrink: 0,
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
