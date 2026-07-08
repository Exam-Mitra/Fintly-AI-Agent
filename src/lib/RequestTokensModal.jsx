import { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { submitTokenRequest } from '../lib/tokenRequests.js';

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function RequestTokensModal({ onClose }) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitTokenRequest(user.uid, { email: user.email, note });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--bg-elevated)', borderRadius: 18,
          border: '1px solid var(--border)', padding: '22px 22px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Request More Tokens</div>
          <button onClick={onClose} style={{ color: 'var(--ink-soft)' }}>
            <CloseIcon />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Request sent!</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              We'll review it and grant you more messages soon.
            </p>
            <button onClick={onClose} style={{
              marginTop: 16, fontSize: 13.5, fontWeight: 700, color: '#0F1115',
              padding: '10px 24px', borderRadius: 12, background: 'var(--accent-gradient)',
            }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.5 }}>
              You've used your free messages for today. Tell us briefly why you need more —
              this goes directly to the Fintly team for review.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I'm preparing for an exam this week and need extra practice questions..."
              rows={4}
              autoFocus
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14,
                fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: 14,
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!note.trim() || submitting}
              style={{
                width: '100%', fontSize: 14, fontWeight: 700, color: '#0F1115',
                padding: '12px 0', borderRadius: 12,
                background: note.trim() ? 'var(--accent-gradient)' : 'var(--surface-2)',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
