import {
  collection, doc, setDoc, deleteDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

// Saved answers live at users/{uid}/saved/{savedId} — a flat list, each item
// optionally tagged with a `folder` name (default "General"). Kept separate
// from `conversations` so deleting/renaming a chat never affects what the
// user has explicitly chosen to keep.
function savedRef(uid) {
  return collection(db, 'users', uid, 'saved');
}

function savedDoc(uid, savedId) {
  return doc(db, 'users', uid, 'saved', savedId);
}

export function newSavedId() {
  return doc(collection(db, '_id')).id;
}

export async function saveAnswer(uid, { text, folder }) {
  const id = newSavedId();
  await setDoc(savedDoc(uid, id), {
    text,
    folder: (folder || 'General').trim() || 'General',
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteSavedAnswer(uid, savedId) {
  await deleteDoc(savedDoc(uid, savedId));
}

export async function moveSavedAnswer(uid, savedId, newFolder) {
  await updateDoc(savedDoc(uid, savedId), { folder: (newFolder || 'General').trim() || 'General' });
}

export function watchSavedAnswers(uid, callback) {
  const q = query(savedRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

export function groupByFolder(items) {
  const groups = {};
  for (const item of items) {
    const key = item.folder || 'General';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
