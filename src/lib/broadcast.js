import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

function broadcastDoc() {
  return doc(db, 'config', 'broadcast');
}

export function watchBroadcast(callback) {
  return onSnapshot(broadcastDoc(), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function postBroadcast(message) {
  await setDoc(broadcastDoc(), {
    message: (message || '').trim().slice(0, 300),
    id: `${Date.now()}`,
    postedAt: serverTimestamp(),
  });
}

export async function clearBroadcast() {
  await setDoc(broadcastDoc(), { message: '', id: `${Date.now()}`, postedAt: serverTimestamp() });
}
