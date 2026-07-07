import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { createConversation, getConversation, saveMessages, newConversationId } from '../lib/conversations.js';
import { getFintlyResponse } from '../lib/agent.js';

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);

function Thinking() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '14px 18px' }}>
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);
  const currentIdRef = useRef(conversationId || null);

  useEffect(() => {
    currentIdRef.current = conversationId || null;
    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const convo = await getConversation(user.uid, conversationId);
      setMessages(convo?.messages || []);
    })();
  }, [conversationId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');

    let id = currentIdRef.current;
    const isNew = !id;
    if (isNew) {
      id = newConversationId();
      currentIdRef.current = id;
      await createConversation(user.uid, id, text);
      navigate(`/chat/${id}`, { replace: true });
    }

    const userMsg = { role: 'user', text, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setSending(true);

    try {
      const replyText = await getFintlyResponse(updated);
      const botMsg = { role: 'assistant', text: replyText, ts: Date.now() };
      const finalMessages = [...updated, botMsg];
      setMessages(finalMessages);
      await saveMessages(user.uid, id, finalMessages);
    } catch (e) {
      const errMsg = { role: 'assistant', text: "Something went wrong reaching Fintly Pro. Please try again.", ts: Date.now() };
      setMessages([...updated, errMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen((v) => !v)} style={{ color: 'var(--ink-soft)', flexShrink: 0 }}>
            <MenuIcon />
          </button>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            <span className="gradient-text">Fintly AI Agent</span>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 14px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '14vh', padding: '0 12px' }}>
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  <span className="gradient-text">Fintly AI Agent</span>
                </h1>
                <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                  Ask anything. Fintly Pro thinks it through from every angle.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'assistant' && (
                  <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6, marginLeft: 4 }}>
                    Fintly Pro
                  </div>
                )}
                <div style={{
                  maxWidth: '88%',
                  background: m.role === 'user' ? 'var(--surface-2)' : 'var(--surface)',
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderRadius: 16,
                  padding: '13px 16px',
                  fontSize: 15,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6, marginLeft: 4 }}>
                  Fintly Pro
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                  <Thinking />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 14px calc(16px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          <div style={{
            maxWidth: 720, margin: '0 auto', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 18, padding: '5px 6px 5px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Message Fintly AI Agent…"
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 16, padding: '9px 0',
              }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: input.trim() ? 'var(--accent-gradient)' : 'var(--surface-2)',
                color: input.trim() ? '#0F1115' : 'var(--ink-faint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <SendIcon />
            </button>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 11, marginTop: 8, padding: '0 8px' }}>
            Fintly Pro synthesizes multiple AI models for the most accurate answer.
          </div>
        </div>
      </div>
    </div>
  );
}
