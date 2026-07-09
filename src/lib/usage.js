import { doc, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export const DAILY_LIMIT = 50;
export const GRACE_MESSAGES = 1;

function profileDoc(uid) {
  return doc(db, 'users', uid);
}

function grantsDoc(uid) {
  return doc(db, 'users', uid, 'grants', 'status');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function watchUsage(uid, callback) {
  let profileLoaded = false;
  let grantsLoaded = false;
  let latestProfile = {};
  let latestGrants = {};

  const emit = () => {
    if (!profileLoaded || !grantsLoaded) return;

    const unlimited = !!latestGrants.unlimited;
    const today = todayStr();
    const dailyUsed = latestProfile.usage?.date === today ? (latestProfile.usage.count || 0) : 0;
    const dailyCap = DAILY_LIMIT + GRACE_MESSAGES;
    const dailyRemaining = Math.max(0, dailyCap - dailyUsed);
    const extraMessages = (latestGrants.extraMessages || 0) + (latestProfile.referralBonus || 0);

    callback({
      dailyUsed,
      dailyCap,
      dailyRemaining,
      extraMessages,
      unlimited,
      canSend: unlimited || dailyRemaining > 0 || extraMessages > 0,
      isLastFreeMessage: !unlimited && dailyRemaining === 1 && extraMessages === 0,
      usingExtra: !unlimited && dailyRemaining === 0 && extraMessages > 0,
    });
  };

  const unsub1 = onSnapshot(profileDoc(uid), (snap) => {
    latestProfile = snap.exists() ? snap.data() : {};
    profileLoaded = true;
    emit();
  });
  const unsub2 = onSnapshot(grantsDoc(uid), (snap) => {
    latestGrants = snap.exists() ? snap.data() : {};
    grantsLoaded = true;
    emit();
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export async function consumeMessageCredit(uid) {
  const pDoc = profileDoc(uid);
  const gDoc = grantsDoc(uid);

  return runTransaction(db, async (tx) => {
    const [profileSnap, grantsSnap] = await Promise.all([tx.get(pDoc), tx.get(gDoc)]);
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    const grants = grantsSnap.exists() ? grantsSnap.data() : {};

    if (grants.unlimited) {
      return { ok: true };
    }

    const today = todayStr();
    const dailyUsed = profile.usage?.date === today ? (profile.usage.count || 0) : 0;
    const dailyCap = DAILY_LIMIT + GRACE_MESSAGES;

    if (dailyUsed < dailyCap) {
      tx.set(pDoc, { usage: { date: today, count: dailyUsed + 1 } }, { merge: true });
      return { ok: true };
    }

    const adminExtra = grants.extraMessages || 0;
    if (adminExtra > 0) {
      tx.set(gDoc, { extraMessages: adminExtra - 1 }, { merge: true });
      return { ok: true };
    }

    const referralBonus = profile.referralBonus || 0;
    if (referralBonus > 0) {
      tx.set(pDoc, { referralBonus: referralBonus - 1 }, { merge: true });
      return { ok: true };
    }

    return { ok: false };
  });
}
