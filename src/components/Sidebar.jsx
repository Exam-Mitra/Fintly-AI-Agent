import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { logout } from '../lib/firebase.js';
import { watchConversations, deleteConversation, newConversationId } from '../lib/conversations.js';

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

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchConversations(user.uid, setConversations);
    return unsub;
  }, [user]);

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
    <div style={{
      position: isOpen ? 'fixed' : 'relative',
      zIndex: 30, top: 0, left: 0, height: '100vh',
      width: 260, background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transform: isOpen === false ? 'translateX(-100%)' : 'translateX(0)',
      transition: 'transform 0.2s ease',
    }}>
      <div style={{ padding: 16 }}>
        <button onClick={handleNewChat} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--accent-gradient)', color: '#0F1115', fontWeight: 700, fontSize: 14,
          padding: '11px 0', borderRadius: 12,
        }}>
          <PlusIcon /> New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', padding: '8px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Chat History
        </div>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => handleOpenChat(c.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '10px 12px', borderRadius: 10, textAlign: 'left',
              background: conversationId === c.id ? 'var(--surface-2)' : 'transparent',
              marginBottom: 2,
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
              style={{ color: 'var(--ink-faint)', flexShrink: 0, padding: 4 }}
            >
              <TrashIcon />
            </span>
          </button>
        ))}
        {conversations.length === 0 && (
          <div style={{ color: 'var(--ink-faint)', fontSize: 13, padding: '12px 10px' }}>
            No conversations yet.
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: 16,
        borderTop: '1px solid var(--border)',
      }}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0F1115',
          }}>
            {(user?.email || '?')[0].toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.displayName || user?.email}
          </div>
        </div>
        <button onClick={logout} style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
