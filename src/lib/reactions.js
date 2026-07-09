import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

// Logs a lightweight thumbs-up/down signal for a specific assistant message,
// keyed by conversation + message index so re-reacting just overwrites the
// previous choice. This is purely for your own future quality tracking (e.g.
// noticing which kinds of questions get thumbs-down most often) — it never
// affects what the user sees or how the AI responds.
export async function logReaction(uid, conversationId, messageIndex, value) {
  const reactionId = `${conversationId}_${messageIndex}`;
  await setDoc(doc(db, 'users', uid, 'reactions', reactionId), {
    conversationId,
    messageIndex,
    value, // 'up' | 'down'
    updatedAt: serverTimestamp(),
  });
}
