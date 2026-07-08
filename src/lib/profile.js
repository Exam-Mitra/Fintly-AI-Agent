import { doc, setDoc, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase.js';

function profileDoc(uid) {
  return doc(db, 'users', uid);
}

// Live-subscribes to the user's profile doc (custom instructions + remembered
// facts). If the doc doesn't exist yet (brand-new user), returns sensible
// empty defaults instead of null so callers never need extra null-checks.
export function watchProfile(uid, callback) {
  return onSnapshot(profileDoc(uid), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    callback({
      customInstructions: data.customInstructions || '',
      memories: Array.isArray(data.memories) ? data.memories : [],
    });
  });
}

export async function saveCustomInstructions(uid, text) {
  await setDoc(profileDoc(uid), { customInstructions: text }, { merge: true });
}

export async function addMemory(uid, fact) {
  const trimmed = (fact || '').trim();
  if (!trimmed) return;
  await setDoc(profileDoc(uid), { memories: arrayUnion(trimmed) }, { merge: true });
}

export async function removeMemory(uid, fact) {
  await setDoc(profileDoc(uid), { memories: arrayRemove(fact) }, { merge: true });
}
