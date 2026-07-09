import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

const REFERRAL_BONUS = 20;

function referralCodeFromUid(uid) {
  return uid.slice(0, 8);
}

function referralMapDoc(code) {
  return doc(db, 'referralCodes', code);
}

function referralClaimDoc(newUid) {
  return doc(db, 'referralClaims', newUid);
}

function profileDoc(uid) {
  return doc(db, 'users', uid);
}

export async function getOrCreateReferralCode(uid) {
  const code = referralCodeFromUid(uid);
  const mapRef = referralMapDoc(code);
  const snap = await getDoc(mapRef);
  if (!snap.exists()) {
    await setDoc(mapRef, { uid, createdAt: serverTimestamp() });
  }
  return code;
}

export function buildReferralLink(code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?ref=${code}`;
}

export async function claimReferral(code, newUid) {
  if (!code || !newUid) return { ok: false, reason: 'missing_params' };

  const mapRef = referralMapDoc(code);
  const mapSnap = await getDoc(mapRef);
  if (!mapSnap.exists()) return { ok: false, reason: 'invalid_code' };

  const referrerUid = mapSnap.data().uid;
  if (referrerUid === newUid) return { ok: false, reason: 'self_referral' };

  const claimRef = referralClaimDoc(newUid);

  return runTransaction(db, async (tx) => {
    const existingClaim = await tx.get(claimRef);
    if (existingClaim.exists()) {
      return { ok: false, reason: 'already_claimed' };
    }

    const referrerProfileRef = profileDoc(referrerUid);
    const newUserProfileRef = profileDoc(newUid);
    const [referrerSnap, newUserSnap] = await Promise.all([
      tx.get(referrerProfileRef),
      tx.get(newUserProfileRef),
    ]);

    const referrerBonus = referrerSnap.exists() ? (referrerSnap.data().referralBonus || 0) : 0;
    const newUserBonus = newUserSnap.exists() ? (newUserSnap.data().referralBonus || 0) : 0;

    tx.set(referrerProfileRef, { referralBonus: referrerBonus + REFERRAL_BONUS }, { merge: true });
    tx.set(newUserProfileRef, { referralBonus: newUserBonus + REFERRAL_BONUS }, { merge: true });
    tx.set(claimRef, { referrerUid, newUid, createdAt: serverTimestamp() });

    return { ok: true, bonus: REFERRAL_BONUS };
  });
}
