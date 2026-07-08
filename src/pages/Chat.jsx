import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import StreamingMessage from '../components/StreamingMessage.jsx';
import SuggestionCards from '../components/SuggestionCards.jsx';
import MessageActions from '../components/MessageActions.jsx';
import EngineStatus from '../components/EngineStatus.jsx';
import QuickActions from '../components/QuickActions.jsx';
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
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function FintlyAvatar() {
  return (
    <div className="avatar-badge">
      <img src="/logo.svg" alt="" />
    </div>
  );
}

function UserAvatar({ user }) {
  if (user?.photoURL) {
    return <img src={user.photoURL} alt="" style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 8, background: 'var(--surface-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
      color: 'var(--ink-soft)', flexShrink: 0,
    }}>
      {(user?.displayName || user?.email || '?')[0].toUpperCase()}
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
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const currentIdRef = useRef(conversationId || null);
  const abortRef = useRef(null);
  // When we create a brand-new conversation ourselves and navigate to its URL,
  // we must NOT let the "load conversation from Firestore" effect below
  // immediately overwrite the in-memory messages we already have (which include
  // the just-sent user message and, shortly after, the AI reply).
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    currentIdRef.current = conversationId || null;

    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }

    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const convo = await getConversation(user.uid, conversationId);
      const loaded = (convo?.messages || []).map((m) => ({ ...m, animate: false }));
      setMessages(loaded);
    })();
  }, [conversationId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = async (baseMessages, conversationDocId) => {
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getFintlyResponse(baseMessages, { signal: controller.signal });
      const botMsg = {
        role: 'assistant',
        text: data.reply,
        ts: Date.now(),
        animate: true,
        meta: {
          modelsUsed: data.modelsUsed,
          totalEngines: data.totalEngines,
          elapsedMs: data.elapsedMs,
          engineTimings: data.engineTimings,
        },
      };
      const finalMessages = [...baseMessages, botMsg];
      setMessages(finalMessages);
      await saveMessages(user.uid, conversationDocId, stripAnimateFlag(finalMessages));
    } catch (e) {
      if (e.name === 'AbortError') {
        // User pressed Stop — keep whatever was already there, no error bubble.
        return;
      }
      const errMsg = { role: 'assistant', text: 'Something went wrong reaching Fintly Pro. Please try again.', ts: Date.now(), animate: false };
      setMessages([...baseMessages, errMsg]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput('');

    const userMsg = { role: 'user', text, ts: Date.now(), animate: false };
    const updated = [...messages, userMsg];
    setMessages(updated);

    let id = currentIdRef.current;
    if (!id) {
      id = newConversationId();
      currentIdRef.current = id;
      skipNextLoadRef.current = true;
      await createConversation(user.uid, id, text);
      navigate(`/chat/${id}`, { replace: true });
    }

    sendMessage(updated, id);
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  const regenerate = (assistantIndex) => {
    if (sending) return;
    const truncated = messages.slice(0, assistantIndex);
    setMessages(truncated);
    sendMessage(truncated, currentIdRef.current);
  };

  const startEdit = (index) => {
    if (sending) return;
    setEditingIndex(index);
    setEditText(messages[index].text);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const saveEdit = async (index) => {
    const text = editText.trim();
    if (!text) return;
    // Editing a user message discards everything after it (including the old
    // reply) and re-asks with the corrected question — same behavior as ChatGPT.
    const truncated = messages.slice(0, index);
    const updated = [...truncated, { role: 'user', text, ts: Date.now(), animate: false }];
    setEditingIndex(null);
    setEditText('');
    setMessages(updated);
    sendMessage(updated, currentIdRef.current);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
            <img src="/logo.svg" alt="" style={{ width: 20, height: 20 }} />
            <span className="gradient-text">Fintly AI Agent</span>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 14px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '10vh', padding: '0 12px' }}>
                <img src="/logo.svg" alt="" style={{ width: 44, height: 44, marginBottom: 14 }} />
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  <span className="gradient-text">Fintly AI Agent</span>
                </h1>
                <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                  Ask anything. Fintly Pro thinks it through from every angle.
                </p>
                <SuggestionCards onPick={(prompt) => send(prompt)} />
              </div>
            )}

            {messages.map((m, i) => {
              const isLastAssistant = m.role === 'assistant' && i === messages.length - 1;
              const isEditing = editingIndex === i;

              return (
                <div key={i} className="message-row" style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, maxWidth: isEditing ? '100%' : '92%', width: isEditing ? '100%' : 'auto', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    {m.role === 'assistant' ? <FintlyAvatar /> : <UserAvatar user={user} />}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: isEditing ? '100%' : 'auto' }}>
                      {m.role === 'assistant' && (
                        <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6 }}>
                          Fintly Pro
                        </div>
                      )}

                      {isEditing ? (
                        <div style={{ width: '100%', maxWidth: 480 }}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            rows={3}
                            style={{
                              width: '100%', background: 'var(--surface-2)', border: '1px solid var(--accent-blue)',
                              borderRadius: 14, padding: '12px 14px', color: 'var(--ink)', fontSize: 15,
                              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button onClick={cancelEdit} style={{
                              fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)',
                              padding: '7px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)',
                            }}>
                              Cancel
                            </button>
                            <button onClick={() => saveEdit(i)} style={{
                              fontSize: 12.5, fontWeight: 700, color: '#0F1115',
                              padding: '7px 14px', borderRadius: 10, background: 'var(--accent-gradient)',
                            }}>
                              Save & Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            background: m.role === 'user' ? 'var(--surface-2)' : 'var(--surface)',
                            border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                            borderRadius: 16,
                            padding: '13px 16px',
                            wordBreak: 'break-word',
                          }}>
                            {m.role === 'assistant' ? (
                              <StreamingMessage text={m.text} animate={!!m.animate} />
                            ) : (
                              <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                            )}
                          </div>

                          {m.role === 'assistant' && isLastAssistant && <EngineStatus meta={m.meta} />}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: m.role === 'user' ? 0 : 4, marginRight: m.role === 'user' ? 4 : 0, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            {m.role === 'assistant' && !sending && (
                              <MessageActions
                                text={m.text}
                                onRegenerate={() => regenerate(i)}
                                showRegenerate={isLastAssistant}
                              />
                            )}
                            {m.role === 'user' && !sending && (
                              <button onClick={() => startEdit(i)} title="Edit" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 24, height: 24, borderRadius: 8, color: 'var(--ink-faint)',
                              }}>
                                <EditIcon />
                              </button>
                            )}
                          </div>

                          {isLastAssistant && !sending && (
                            <QuickActions onPick={(prompt) => send(prompt)} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="message-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <FintlyAvatar />
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6 }}>
                      Fintly Pro
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                      <Thinking />
                    </div>
                  </div>
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
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Message Fintly AI Agent…"
              disabled={sending}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 16, padding: '9px 0',
              }}
            />
            {sending ? (
              <button
                onClick={stopGenerating}
                title="Stop generating"
                style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: 'var(--surface-2)', color: 'var(--ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <StopIcon />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: input.trim() ? 'var(--accent-gradient)' : 'var(--surface-2)',
                  color: input.trim() ? '#0F1115' : 'var(--ink-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <SendIcon />
              </button>
            )}
          </div>
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 11, marginTop: 8, padding: '0 8px' }}>
            Fintly Pro synthesizes multiple AI engines for the most accurate answer.
          </div>
        </div>
      </div>
    </div>
  );
}

function stripAnimateFlag(messages) {
  // Firestore doesn't need the transient `animate` UI flag saved — strip it
  // (but keep `meta` so the transparency panel can be reconstructed even
  // right after reloading a saved conversation, if desired later).
  return messages.map(({ animate, ...rest }) => rest);
}
