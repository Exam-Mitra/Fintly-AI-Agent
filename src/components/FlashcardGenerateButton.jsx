import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { generateFlashcards } from '../lib/flashcardsApi.js';
import { saveFlashcardSet } from '../lib/flashcards.js';

const CardsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M7 6V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
  </svg>
);
const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// One tap under any Fintly Pro answer turns it into a study flashcard set,
// saved to the user's own flashcard library (Sidebar -> Flashcards), then
// jumps straight into study mode. Uses a single fast free model
// server-side (see api/generate-flashcards.js), not the full 5-engine
// pipeline — flashcard generation doesn't need multi-model consensus.
export default function FlashcardGenerateButton({ text }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const cards = await generateFlashcards(text, 8);
      const setId = await saveFlashcardSet(user.uid, { sourceText: text, cards });
      navigate(`/flashcards/${setId}`);
    } catch (err) {
      setError(err.message || 'Could not generate flashcards.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        title="Turn this answer into flashcards"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 8, color: 'var(--ink-faint)',
        }}
      >
        {busy ? <SpinnerIcon /> : <CardsIcon />}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 4, whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </>
  );
}
