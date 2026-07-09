import {
  collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

// Flashcard SETS live at users/{uid}/flashcards/{setId}, each holding an
// array of { question, answer } pairs generated from one Fintly Pro answer.
// Kept as its own top-level collection (like `saved`) rather than nested
// under conversations, so a user's whole flashcard library survives even if
// they later delete the original chat it came from.
function flashcardSetsRef(uid) {
  return collection(db, 'users', uid, 'flashcards');
}

function flashcardSetDoc(uid, setId) {
  return doc(db, 'users', uid, 'flashcards', setId);
}

export function newFlashcardSetId() {
  return doc(collection(db, '_id')).id;
}

export async function saveFlashcardSet(uid, { sourceText, cards }) {
  const id = newFlashcardSetId();
  const title = (sourceText || 'Flashcards').replace(/\s+/g, ' ').trim().slice(0, 60);
  await setDoc(flashcardSetDoc(uid, id), {
    title,
    cards, // [{ question, answer }]
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteFlashcardSet(uid, setId) {
  await deleteDoc(flashcardSetDoc(uid, setId));
}

export function watchFlashcardSets(uid, callback) {
  const q = query(flashcardSetsRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Parses the AI's flashcard-generation output. We ask the model to reply in
// a strict "Q: ...\nA: ...\n\nQ: ...\nA: ..." format (see the prompt built
// in api/agent.js's flashcard mode) specifically because it's trivially
// parseable without needing the model to produce valid JSON (smaller/free
// models are considerably less reliable at strict JSON than at following a
// simple line-based pattern).
export function parseFlashcardsFromText(text) {
  const cards = [];
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const qMatch = block.match(/Q:\s*([\s\S]+?)(?=\nA:)/i);
    const aMatch = block.match(/A:\s*([\s\S]+)/i);
    if (qMatch && aMatch) {
      const question = qMatch[1].trim();
      const answer = aMatch[1].trim();
      if (question && answer) cards.push({ question, answer });
    }
  }
  return cards;
}
