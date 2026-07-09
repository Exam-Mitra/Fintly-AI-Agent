import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { deleteFlashcardSet } from '../lib/flashcards.js';

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

// A simple, distraction-free "tap card to flip, swipe through the deck"
// study mode — the classic flashcard UX students already know from Anki/
// Quizlet, built entirely with local component state (no backend calls
// needed once the set is loaded, so it works smoothly even on a slow
// mobile connection).
export default function Flashcards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!user || !setId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid, 'flashcards', setId));
      setSet(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    })();
  }, [user, setId]);

  const goNext = () => {
    if (!set) return;
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, set.cards.length - 1));
  };

  const goPrev = () => {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  };

  const handleDelete = async () => {
    if (!confirm('Delete this flashcard set?')) return;
    await deleteFlashcardSet(user.uid, setId);
    navigate('/flashcards');
  };

  if (loading) return null;

  if (!set) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-faint)', fontSize: 14, marginBottom: 16 }}>Flashcard set not found.</div>
          <button onClick={() => navigate('/flashcards')} style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: 14 }}>
            Back to Flashcards
          </button>
        </div>
      </div>
    );
  }

  const card = set.cards[index];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5,
      }}>
        <button onClick={() => navigate('/flashcards')} style={{ color: 'var(--ink-soft)' }}>
          <BackIcon />
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {set.title}
        </div>
        <button onClick={handleDelete} title="Delete set" style={{ color: 'var(--ink-faint)' }}>
          <TrashIcon />
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ color: 'var(--ink-faint)', fontSize: 13, marginBottom: 20 }}>
          Card {index + 1} of {set.cards.length}
        </div>

        <div
          onClick={() => setFlipped((f) => !f)}
          style={{
            width: '100%', minHeight: 260, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '32px 24px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
            color: 'var(--accent-blue)', marginBottom: 16,
          }}>
            {flipped ? 'Answer' : 'Question'}
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.6 }}>
            {flipped ? card.answer : card.question}
          </div>
        </div>

        <div style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginTop: 14 }}>
          Tap the card to {flipped ? 'see the question' : 'reveal the answer'}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28, width: '100%' }}>
          <button
            onClick={goPrev}
            disabled={index === 0}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
              background: 'var(--surface-2)', color: index === 0 ? 'var(--ink-faint)' : 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            ← Previous
          </button>
          <button
            onClick={goNext}
            disabled={index === set.cards.length - 1}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
              background: index === set.cards.length - 1 ? 'var(--surface-2)' : 'var(--accent-gradient)',
              color: index === set.cards.length - 1 ? 'var(--ink-faint)' : '#0F1115',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
