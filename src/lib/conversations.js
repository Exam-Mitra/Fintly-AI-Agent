// Firestore-backed conversation storage — cloud-synced per user account.
// Data model: users/{uid}/conversations/{conversationId} -> { title, createdAt, updatedAt, messages: [...] }

import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase.js';

function conversationsRef(uid) {
  return collection(db, 'users', uid, 'conversations');
}

function conversationDoc(uid, conversationId) {
  return doc(db, 'users', uid, 'conversations', conversationId);
}

export function newConversationId() {
  return doc(collection(db, '_id')).id; // Firestore auto-id generator trick
}

export async function createConversation(uid, conversationId, firstMessageText) {
  const title = (firstMessageText || 'New chat').slice(0, 60);
  await setDoc(conversationDoc(uid, conversationId), {
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messages: [],
  });
}

export async function saveMessages(uid, conversationId, messages) {
  await setDoc(
    conversationDoc(uid, conversationId),
    { messages, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getConversation(uid, conversationId) {
  const snap = await getDoc(conversationDoc(uid, conversationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteConversation(uid, conversationId) {
  await deleteDoc(conversationDoc(uid, conversationId));
}

// Real-time listener for the sidebar's conversation list, ordered by most recently updated.
export function watchConversations(uid, callback) {
  const q = query(conversationsRef(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}
