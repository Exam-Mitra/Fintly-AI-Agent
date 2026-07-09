import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from './firebase.js';

// Shareable, read-only chat links — like ChatGPT's "Share" button. A shared
// snapshot lives in its own top-level `sharedChats/{shareId}` document
// (never the private `users/{uid}/conversations/...` doc itself) so:
//   1. Anyone with the link can read it WITHOUT signing in (Firestore rules
//      make this one collection public-read), while everything else in the
//      user's account stays fully private.
//   2. Editing/deleting the original conversation later never silently
//      changes what a previously-shared link shows — it's a frozen copy at
//      the moment of sharing (the user can always re-share to update it).
function sharedChatDoc(shareId) {
  return doc(db, 'sharedChats', shareId);
}

export function newShareId() {
  return doc(collection(db, '_id')).id;
}

// Strips anything we don't want a public, logged-out viewer to see (no
// engine-timing internals need hiding since those are already anonymized,
// but we do drop `apiText`, which can contain full raw text-file/PDF
// content the sharer may not intend to publish).
function sanitizeMessages(messages) {
  return messages.map(({ apiText, ...rest }) => rest);
}

export async function createSharedChat(uid, { title, messages }) {
  const shareId = newShareId();
  await setDoc(sharedChatDoc(shareId), {
    ownerUid: uid,
    title: (title || 'Shared chat').slice(0, 80),
    messages: sanitizeMessages(messages),
    createdAt: serverTimestamp(),
  });
  return shareId;
}

export async function getSharedChat(shareId) {
  const snap = await getDoc(sharedChatDoc(shareId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Only the original sharer can revoke it (enforced by Firestore rules
// checking ownerUid == request.auth.uid) — once revoked, the link 404s for
// anyone who had it.
export async function revokeSharedChat(shareId) {
  await deleteDoc(sharedChatDoc(shareId));
}

export function buildShareLink(shareId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/share/${shareId}`;
}
