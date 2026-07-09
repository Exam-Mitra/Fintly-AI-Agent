import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { logout } from '../lib/firebase.js';
import { watchConversations, deleteConversation } from '../lib/conversations.js';
import { isAdmin } from '../lib/admin.js';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const BookmarkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);
const CardsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M7 6V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

function groupByDate(conversations) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;

  const groups = { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] };

  for (const c of conversations) {
    const t = c.updatedAt?.toMillis ? c.updatedAt.toMillis() : (c.updatedAt?.seconds ? c.updatedAt.seconds * 1000 : 0);
    if (t >= startOfToday) groups.Today.push(c);
    else if (t >= startOfYesterday) groups.Yesterday.push(c);
    else if (t >= startOfWeek) groups['Previous 7 Days'].push(c);
    else groups.Older.push(c);
  }
  return groups;
}

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = watchConversations(user.uid, setConversations);
    return unsub;
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const handleNewChat = () => {
    navigate('/');
    onClose?.();
  };

  const handleOpenChat = (id) => {
    navigate(`/chat/${id}`);
    onClose?.();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await deleteConversation(user.uid, id);
    if (conversationId === id) navigate('/');
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <img src="/logo.svg" alt="" style={{ width: 22, height: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 14.5 }} className="gradient-text">Fintly</span>
          </div>
          <button onClick={onClose} className="sidebar-close-btn" style={{ color: 'var(--ink-soft)', padding: 6, flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: '4px 16px 12px' }}>
          <button onClick={handleNewChat} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--accent-gradient)', color: '#0F1115', fontWeight: 700, fontSize: 14,
            padding: '11px 0', borderRadius: 12,
          }}>
            <PlusIcon /> New Chat
          </button>
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)',
            borderRadius: 10, padding: '8px 12px',
          }}>
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 13.5,
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
          {Object.entries(grouped).map(([label, items]) => {
            if (!items.length) return null;
            return (
              <div key={label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', padding: '10px 10px 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {label}
                </div>
                {items.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleOpenChat(c.id)}
                    className="sidebar-chat-item"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '9px 12px', borderRadius: 10, textAlign: 'left',
                      background: conversationId === c.id ? 'var(--surface-2)' : 'transparent',
                      marginBottom: 1,
                    }}
                  >
                    <span style={{
                      fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {c.title || 'New chat'}
                    </span>
                    <span
                      onClick={(e) => handleDelete(e, c.id)}
                      className="sidebar-delete-icon"
                      style={{ color: 'var(--ink-faint)', flexShrink: 0, padding: 4 }}
                    >
                      <TrashIcon />
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13, padding: '16px 10px', textAlign: 'center' }}>
              {search ? 'No matching chats.' : 'No conversations yet.'}
            </div>
          )}
        </div>

        <div style={{ padding: '0 10px 6px' }}>
          <button
            onClick={() => { navigate('/saved'); onClose?.(); }}
            className="sidebar-chat-item"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, textAlign: 'left', color: 'var(--ink-soft)',
            }}
          >
            <BookmarkIcon />
            <span style={{ fontSize: 13.5 }}>Saved Answers</span>
          </button>
          <button
            onClick={() => { navigate('/flashcards'); onClose?.(); }}
            className="sidebar-chat-item"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, textAlign: 'left', color: 'var(--ink-soft)',
            }}
          >
            <CardsIcon />
            <span style={{ fontSize: 13.5 }}>Flashcards</span>
          </button>
          <button
            onClick={() => { navigate('/settings'); onClose?.(); }}
            className="sidebar-chat-item"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, textAlign: 'left', color: 'var(--ink-soft)',
            }}
          >
            <SettingsIcon />
            <span style={{ fontSize: 13.5 }}>Settings</span>
          </button>
          {isAdmin(user) && (
            <button
              onClick={() => { navigate('/admin'); onClose?.(); }}
              className="sidebar-chat-item"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, textAlign: 'left', color: 'var(--accent-blue)',
              }}
            >
              <ShieldIcon />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Admin Panel</span>
            </button>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: 16,
          borderTop: '1px solid var(--border)',
        }}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0F1115',
              flexShrink: 0,
            }}>
              {(user?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName || user?.email}
            </div>
          </div>
          <button onClick={logout} style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, flexShrink: 0 }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
