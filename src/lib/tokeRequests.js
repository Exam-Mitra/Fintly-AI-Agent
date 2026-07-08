import {
  collection, doc, setDoc, getDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

// A single top-level collection (not nested under each user) so the admin
// can list ALL pending requests across every user in one query. Firestore
// security rules restrict: any signed-in user may CREATE a request for
// themselves; only the admin account may READ the full list or UPDATE a
// request's status/grant.
function requestsRef() {
  return collection(db, 'tokenRequests');
}

function requestDoc(id) {
  return doc(db, 'tokenRequests', id);
}

export function newRequestId() {
  return doc(collection(db, '_id')).id;
}

export async function submitTokenRequest(uid, { email, note }) {
  const id = newRequestId();
  await setDoc(requestDoc(id), {
    uid,
    email: email || '',
    note: (note || '').trim().slice(0, 500),
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    createdAt: serverTimestamp(),
  });
  return id;
}

// Admin-only in practice (enforced by Firestore rules) — lists every request,
// newest first, so the Admin Panel can render pending ones on top.
export function watchAllTokenRequests(callback) {
  const q = query(requestsRef(), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// A user can watch just their own requests (e.g. to show "pending" status in
// Settings). The query itself is filtered by uid == the signed-in user's uid
// so Firestore's security rules can validate every document in the result
// set individually (an un-filtered query would be rejected for non-admins).
export function watchMyTokenRequests(uid, callback) {
  const q = query(requestsRef(), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function markRequestStatus(id, status) {
  await updateDoc(requestDoc(id), { status, resolvedAt: serverTimestamp() });
}

// Admin-only action (enforced by Firestore rules): grants a specific number
// of extra messages, or flips the user to permanently unlimited, then marks
// the originating request as approved in the same call.
export async function approveTokenRequest(requestId, targetUid, { extraMessages, unlimited }) {
  const grantDocRef = doc(db, 'users', targetUid, 'grants', 'status');
  if (unlimited) {
    await setDoc(grantDocRef, { unlimited: true }, { merge: true });
  } else if (extraMessages > 0) {
    // Additive — if the user still has leftover extra messages from a prior
    // grant, a new approval adds on top rather than overwriting.
    const snap = await getDoc(grantDocRef);
    const current = snap.exists() ? (snap.data().extraMessages || 0) : 0;
    await setDoc(grantDocRef, { extraMessages: current + extraMessages }, { merge: true });
  }
  await markRequestStatus(requestId, 'approved');
}
