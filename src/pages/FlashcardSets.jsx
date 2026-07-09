import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { watchFlashcardSets, deleteFlashcardSet } from '../lib/flashcards.js';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const CardsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M7 6V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
  </svg>
);

export default function FlashcardSets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchFlashcardSets(user.uid, setSets);
    return unsub;
  }, [user]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this flashcard set?')) return;
    await deleteFlashcardSet(user.uid, id);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5,
      }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--ink-soft)' }}>
          <BackIcon />
        </button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Flashcards</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>
        {sets.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, marginTop: '15vh' }}>
            No flashcard sets yet.<br />
            Tap the flashcard icon under any Fintly Pro answer to turn it into a study set.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sets.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/flashcards/${s.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)', flexShrink: 0,
              }}>
                <CardsIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                  {(s.cards || []).length} cards
                </div>
              </div>
              <span onClick={(e) => handleDelete(e, s.id)} style={{ color: 'var(--ink-faint)', flexShrink: 0, padding: 6 }}>
                <TrashIcon />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
