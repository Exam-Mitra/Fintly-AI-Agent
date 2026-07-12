import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import StreamingMessage from '../components/StreamingMessage.jsx';
import SuggestionCards from '../components/SuggestionCards.jsx';
import MessageActions from '../components/MessageActions.jsx';
import EngineStatus from '../components/EngineStatus.jsx';
import SourcesList from '../components/SourcesList.jsx';
import QuickActions from '../components/QuickActions.jsx';
import AttachmentChip from '../components/AttachmentChip.jsx';
import ShareChatButton from '../components/ShareChatButton.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { createConversation, getConversation, saveMessages, newConversationId } from '../lib/conversations.js';
import { getFintlyResponse } from '../lib/agent.js';
import { watchProfile, addMemory } from '../lib/profile.js';
import { processAttachedFile } from '../lib/attachments.js';
import { saveAnswer } from '../lib/saved.js';
import { exportAnswerAsPdf } from '../lib/exportPdf.js';
import { watchUsage, consumeMessageCredit } from '../lib/usage.js';
import { logReaction } from '../lib/reactions.js';
import { startListening, isSpeechRecognitionSupported } from '../lib/voice.js';
import { isOnline, queueMessage, getQueuedMessages, removeQueuedMessage, onBackOnline } from '../lib/offlineQueue.js';
import { selectRelevantChunks, buildPdfContext } from '../lib/pdfChat.js';
import RequestTokensModal from '../components/RequestTokensModal.jsx';
import CameraCapture from '../components/CameraCapture.jsx';
import ToolsModal from '../components/ToolsModal.jsx';

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
const PaperclipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const MicIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--danger)' : 'currentColor'} strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
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
  const [profile, setProfile] = useState({ customInstructions: '', memories: [] });
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachError, setAttachError] = useState('');
  const [usage, setUsage] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [listening, setListening] = useState(false);
  const [offline, setOffline] = useState(!isOnline());
  const [pdfContext, setPdfContext] = useState(null); // { name, pageCount } — just for the UI chip; the actual chunks live in pdfChunksRef
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentIdRef = useRef(conversationId || null);
  const abortRef = useRef(null);
  const stopListeningRef = useRef(null);
  const sendRef = useRef(null); // always points at the latest `send` closure, to avoid stale state in the offline-retry listener below
  // Holds the currently-attached PDF's extracted text chunks so every
  // follow-up question in this conversation can keep referencing the same
  // document (re-selecting whichever chunks are most relevant to THAT
  // question) without re-uploading or re-extracting the PDF each time.
  const pdfChunksRef = useRef(null); // { name, chunks: string[] } | null
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

    // A PDF's extracted chunks live only in memory for the conversation the
    // user attached it to — navigating away to a different (or brand-new,
    // non-self-created) chat should drop that reference rather than let a
    // stale document silently keep influencing an unrelated conversation.
    pdfChunksRef.current = null;
    setPdfContext(null);

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
  useEffect(() => () => stopListeningRef.current?.(), []);

  // Tracks browser connectivity and, the moment we come back online, retries
  // any messages that failed to send while offline (queued via
  // lib/offlineQueue.js). Only queued messages belonging to the conversation
  // currently open are retried automatically here — messages queued for
  // other conversations will be retried the next time those chats are opened.
  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const unsubBackOnline = onBackOnline(() => {
      const queued = getQueuedMessages().filter((m) => m.conversationId === currentIdRef.current);
      queued.forEach((q) => {
        removeQueuedMessage(q.id);
        sendRef.current?.(q.text);
      });
    });

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      unsubBackOnline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = watchProfile(user.uid, setProfile);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchUsage(user.uid, setUsage);
    return unsub;
  }, [user]);

  const sendMessage = async (baseMessages, conversationDocId, imageAttachment) => {
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getFintlyResponse(baseMessages, {
        signal: controller.signal,
        customInstructions: profile.customInstructions,
        memories: profile.memories,
        imageAttachment,
      });
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
        sources: data.sources || [],
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

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAttachError('');
    try {
      const processed = await processAttachedFile(file);
      if (processed.kind === 'pdf') {
        // A PDF replaces any earlier PDF context for this conversation —
        // only one "active document" at a time keeps the chunk-selection
        // logic simple and avoids silently mixing content from two
        // unrelated documents into one answer.
        pdfChunksRef.current = { name: processed.name, chunks: processed.chunks };
        setPdfContext({ name: processed.name, pageCount: processed.pageCount });
        setPendingAttachment(null);
      } else {
        setPendingAttachment(processed);
      }
    } catch (err) {
      setAttachError(err.message || 'Could not attach that file.');
      setTimeout(() => setAttachError(''), 4000);
    }
  };

  const removePendingAttachment = () => setPendingAttachment(null);

  const removePdfContext = () => {
    pdfChunksRef.current = null;
    setPdfContext(null);
  };

  const toggleListening = () => {
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      return;
    }
    setListening(true);
    stopListeningRef.current = startListening({
      onResult: (transcript) => {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onError: () => setAttachError('Voice input failed — please try again or type instead.'),
      onEnd: () => setListening(false),
    });
  };

  const send = async (textOverride) => {
    const typed = (textOverride ?? input).trim();
    const attachment = pendingAttachment;
    if (!typed && !attachment && !pdfChunksRef.current) return;
    if (sending) return;

    // No internet right now — queue the plain-text message locally and bail
    // out early rather than letting the request fail with a confusing error.
    // It will be automatically retried the moment connectivity returns (see
    // the `online` listener above). Attachments aren't queued (base64 image
    // payloads are too large to sit safely in localStorage) — those still
    // just show the normal error path if offline.
    if (!isOnline() && !attachment && !pdfChunksRef.current) {
      queueMessage({ conversationId: currentIdRef.current, text: typed });
      setInput('');
      setAttachError('You appear to be offline — this message will send automatically once you\'re back online.');
      setTimeout(() => setAttachError(''), 5000);
      return;
    }

    // Enforce the daily message limit (server-verified via a Firestore
    // transaction so it can't be bypassed by editing client-side state).
    if (usage && !usage.canSend) {
      setShowRequestModal(true);
      return;
    }
    const credit = await consumeMessageCredit(user.uid);
    if (!credit.ok) {
      setShowRequestModal(true);
      return;
    }

    setInput('');
    setPendingAttachment(null);

    if (!attachment) maybeSaveAsMemory(typed);

    // Build the message the user sees, and (if needed) a separate apiText
    // that's actually sent to the AI — e.g. a text file's extracted content
    // gets folded into apiText but never shown as a giant wall of text in
    // the chat bubble itself, only the filename chip is shown.
    let displayText = typed;
    let apiText = typed;
    let attachmentMeta = null;
    let imageAttachment = null;

    if (attachment?.kind === 'image') {
      displayText = typed || 'What can you tell me about this image?';
      apiText = displayText;
      attachmentMeta = { kind: 'image', name: attachment.name };
      imageAttachment = { mimeType: attachment.mimeType, dataBase64: attachment.dataBase64 };
    } else if (attachment?.kind === 'text') {
      displayText = typed || `Please review the attached file: ${attachment.name}`;
      apiText = `${displayText}\n\n--- Attached file: ${attachment.name} ---\n${attachment.content}\n--- End of attached file ---`;
      attachmentMeta = { kind: 'text', name: attachment.name };
    } else if (pdfChunksRef.current) {
      // A PDF is "attached" to this whole conversation (not just one
      // message) — every question re-selects whichever excerpts of the
      // document are most relevant to THAT specific question, so a 40-page
      // PDF never has to be resent in full on every single follow-up.
      displayText = typed || `What can you tell me about ${pdfChunksRef.current.name}?`;
      const relevant = selectRelevantChunks(pdfChunksRef.current.chunks, displayText);
      apiText = `${displayText}\n\n${buildPdfContext(pdfChunksRef.current.name, relevant)}`;
      attachmentMeta = { kind: 'pdf', name: pdfChunksRef.current.name };
    }

    // Firestore rejects `undefined` field values, so we only add `apiText`
    // to the object when it's actually different from the displayed text
    // (never set it to `undefined` directly).
    const userMsg = {
      role: 'user',
      text: displayText,
      attachment: attachmentMeta,
      ts: Date.now(),
      animate: false,
      ...(apiText !== displayText ? { apiText } : {}),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);

    let id = currentIdRef.current;
    if (!id) {
      id = newConversationId();
      currentIdRef.current = id;
      skipNextLoadRef.current = true;
      await createConversation(user.uid, id, displayText);
      navigate(`/chat/${id}`, { replace: true });
    }

    sendMessage(updated, id, imageAttachment);
  };

  useEffect(() => {
    sendRef.current = send;
  });

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  // Lightweight "remember this" detector — if the user explicitly asks Fintly
  // Pro to remember something (e.g. "remember that I'm vegetarian"), save it
  // to their profile automatically so it applies to every future chat, without
  // making them go find the Settings page.
  const maybeSaveAsMemory = (text) => {
    const match = text.match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)/i);
    if (match && match[1] && user) {
      addMemory(user.uid, match[1].trim().replace(/\.$/, ''));
    }
  };

  const regenerate = (assistantIndex) => {
    if (sending) return;
    const truncated = messages.slice(0, assistantIndex);
    setMessages(truncated);
    sendMessage(truncated, currentIdRef.current);
  };

  const handleSaveAnswer = (text) => {
    if (!user) return;
    saveAnswer(user.uid, { text, folder: 'General' });
  };

  const handleExportPdf = (text) => {
    exportAnswerAsPdf(text, 'fintly-answer');
  };

  const handleReact = (index, value) => {
    if (!user || !currentIdRef.current) return;
    logReaction(user.uid, currentIdRef.current, index, value);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}>
            <img src="/logo.svg" alt="" style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span className="gradient-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Fintly AI Agent</span>
          </div>
          <ShareChatButton
            title={messages[0]?.text || 'Fintly AI Agent chat'}
            messages={messages}
            disabled={messages.length === 0}
          />
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
                          {m.role === 'user' && m.attachment && (
                            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'flex-end' }}>
                              <AttachmentChip name={m.attachment.name} kind={m.attachment.kind} />
                            </div>
                          )}

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

                          {m.role === 'assistant' && <SourcesList sources={m.sources} />}

                          {m.role === 'assistant' && isLastAssistant && <EngineStatus meta={m.meta} />}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: m.role === 'user' ? 0 : 4, marginRight: m.role === 'user' ? 4 : 0, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            {m.role === 'assistant' && !sending && (
                              <MessageActions
                                text={m.text}
                                onRegenerate={() => regenerate(i)}
                                showRegenerate={isLastAssistant}
                                onSave={() => handleSaveAnswer(m.text)}
                                onExportPdf={() => handleExportPdf(m.text)}
                                onReact={(value) => handleReact(i, value)}
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
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {offline && (
              <div style={{
                color: '#FFD98A', fontSize: 12.5, marginBottom: 8, padding: '8px 12px',
                background: 'rgba(255, 217, 138, 0.1)', border: '1px solid rgba(255, 217, 138, 0.3)', borderRadius: 10,
              }}>
                📡 You're offline. Messages you send now will queue and go out automatically once you're back online.
              </div>
            )}
            {attachError && (
              <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8, padding: '0 4px' }}>
                {attachError}
              </div>
            )}
            {usage && usage.isLastFreeMessage && (
              <div style={{
                color: '#FFD98A', fontSize: 12.5, marginBottom: 8, padding: '8px 12px',
                background: 'rgba(255, 217, 138, 0.1)', border: '1px solid rgba(255, 217, 138, 0.3)', borderRadius: 10,
              }}>
                ⚠️ You have 1 message left today. After this, you can request more.
              </div>
            )}
            {usage && !usage.canSend && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                color: 'var(--danger)', fontSize: 12.5, marginBottom: 8, padding: '10px 14px',
                background: 'rgba(255, 138, 138, 0.1)', border: '1px solid rgba(255, 138, 138, 0.3)', borderRadius: 10,
              }}>
                <span>You've reached today's message limit.</span>
                <button
                  onClick={() => setShowRequestModal(true)}
                  style={{
                    fontSize: 12, fontWeight: 700, color: '#0F1115', padding: '6px 14px',
                    borderRadius: 20, background: 'var(--accent-gradient)', flexShrink: 0,
                  }}
                >
                  Request More Tokens
                </button>
              </div>
            )}
            {pendingAttachment && (
              <div style={{ marginBottom: 8 }}>
                <AttachmentChip
                  name={pendingAttachment.name}
                  kind={pendingAttachment.kind}
                  previewUrl={pendingAttachment.previewUrl}
                  onRemove={removePendingAttachment}
                />
              </div>
            )}
            {pdfContext && (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AttachmentChip
                  name={`${pdfContext.name} (${pdfContext.pageCount} pages) — active for this chat`}
                  kind="pdf"
                  onRemove={removePdfContext}
                />
              </div>
            )}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 18, padding: '5px 6px 5px 8px',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: usage && !usage.canSend ? 0.5 : 1,
            }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.c,.cpp,.cs,.go,.rb,.php,.sql,.yml,.yaml,.log"
                onChange={handleFileSelected}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || (usage && !usage.canSend)}
                title="Attach an image, PDF, or text file"
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, color: 'var(--ink-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <PaperclipIcon />
              </button>
              <CameraCapture onCapture={setPendingAttachment} disabled={sending || (usage && !usage.canSend)} />
              {isSpeechRecognitionSupported() && (
                <button
                  onClick={toggleListening}
                  disabled={sending || (usage && !usage.canSend)}
                  title={listening ? 'Stop listening' : 'Speak your message'}
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    color: listening ? 'var(--danger)' : 'var(--ink-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: listening ? 'rgba(255,138,138,0.12)' : 'transparent',
                  }}
                >
                  <MicIcon active={listening} />
                </button>
              )}
              <button
                onClick={() => setShowTools(true)}
                disabled={sending || (usage && !usage.canSend)}
                title="Open Fintly Tools (image, documents, web)"
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, color: 'var(--ink-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                🧰
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={usage && !usage.canSend ? 'Daily limit reached — request more above' : 'Message Fintly AI Agent…'}
                disabled={sending || (usage && !usage.canSend)}
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
                  disabled={(!input.trim() && !pendingAttachment && !pdfContext) || (usage && !usage.canSend)}
                  style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: (input.trim() || pendingAttachment || pdfContext) ? 'var(--accent-gradient)' : 'var(--surface-2)',
                    color: (input.trim() || pendingAttachment || pdfContext) ? '#0F1115' : 'var(--ink-faint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 11, marginTop: 8, padding: '0 8px' }}>
            Fintly Pro synthesizes multiple AI engines for the most accurate answer.
          </div>
        </div>
      </div>

      {showRequestModal && <RequestTokensModal onClose={() => setShowRequestModal(false)} />}
      {showTools && (
        <ToolsModal
          open={showTools}
          onClose={() => setShowTools(false)}
          onAddImage={(att) => setPendingAttachment(att)}
          onAddText={(t) => setPendingAttachment({ kind: 'text', name: t.name, content: t.content })}
          onTemplate={(p) => send(p)}
        />
      )}
    </div>
  );
}

function stripAnimateFlag(messages) {
  // Firestore doesn't need the transient `animate` UI flag saved — strip it
  // (but keep `meta` so the transparency panel can be reconstructed even
  // right after reloading a saved conversation, if desired later).
  return messages.map(({ animate, ...rest }) => rest);
}
