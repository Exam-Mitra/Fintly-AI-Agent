import { parseFlashcardsFromText } from './flashcards.js';

// Client-side helper that calls our serverless /api/generate-flashcards
// endpoint and parses the result into { question, answer } pairs. Throws a
// user-facing Error if generation fails or returns something unparseable.
export async function generateFlashcards(sourceText, count = 8) {
  const res = await fetch('/api/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText, count }),
  });

  if (!res.ok) throw new Error('Could not generate flashcards right now — please try again.');

  const data = await res.json();
  if (data.error || !data.text) throw new Error('Could not generate flashcards right now — please try again.');

  const cards = parseFlashcardsFromText(data.text);
  if (!cards.length) throw new Error("Couldn't turn that into flashcards — try a longer or more detailed answer.");

  return cards;
}
