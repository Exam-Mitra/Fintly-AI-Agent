import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

export async function logReaction(uid, conversationId, messageIndex, value) {
  const reactionId = `${conversationId}_${messageIndex}`;
  await setDoc(doc(db, 'users', uid, 'reactions', reactionId), {
    conversationId,
    messageIndex,
    value,
    updatedAt: serverTimestamp(),
  });
}
