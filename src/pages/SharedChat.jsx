import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedChat } from '../lib/shareChat.js';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import SourcesList from '../components/SourcesList.jsx';

// Public, read-only view of a shared chat — deliberately NOT wrapped in
// ProtectedRoute, so anyone with the link can view it without signing in
// (this is the whole point of a "shareable link" feature). Firestore rules
// make the `sharedChats` collection public-read-only, so this page can
// never accidentally expose anything from the user's private account.
export default function SharedChat() {
  const { shareId } = useParams();
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getSharedChat(shareId);
      if (!data) {
        setNotFound(true);
      } else {
        setChat(data);
      }
      setLoading(false);
    })();
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, marginBottom: 10 }}>This shared chat doesn't exist or was removed.</div>
          <Link to="/" style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: 14 }}>Go to Fintly AI Agent</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5,
      }}>
        <img src="/logo.svg" alt="" style={{ width: 20, height: 20 }} />
        <span className="gradient-text" style={{ fontWeight: 700, fontSize: 15 }}>Fintly AI Agent</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>
          Shared chat (read-only)
        </span>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 40px' }}>
        <h1 style={{ fontSize: 19, marginBottom: 20 }}>{chat.title}</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(chat.messages || []).map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '92%' }}>
                {m.role === 'assistant' && (
                  <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6 }}>
                    Fintly Pro
                  </div>
                )}
                <div style={{
                  background: m.role === 'user' ? 'var(--surface-2)' : 'var(--surface)',
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderRadius: 16, padding: '13px 16px', wordBreak: 'break-word',
                }}>
                  {m.role === 'assistant' ? (
                    <MarkdownMessage text={m.text} />
                  ) : (
                    <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  )}
                </div>
                {m.role === 'assistant' && <SourcesList sources={m.sources} />}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40, padding: '20px 0', borderTop: '1px solid var(--border)',
          textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12.5,
        }}>
          Shared from <Link to="/" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Fintly AI Agent</Link> — a free multi-model AI assistant.
        </div>
      </div>
    </div>
  );
}
