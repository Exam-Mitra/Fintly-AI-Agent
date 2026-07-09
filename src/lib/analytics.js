import { collectionGroup, collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from './firebase.js';

export async function getTotalUserCount() {
  const snap = await getCountFromServer(collection(db, 'users'));
  return snap.data().count;
}

export async function getPendingRequestCount() {
  const q = query(collection(db, 'tokenRequests'), where('status', '==', 'pending'));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function getTotalConversationCount() {
  const snap = await getCountFromServer(collectionGroup(db, 'conversations'));
  return snap.data().count;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getTodayMessageTotal() {
  const snap = await getDocs(collection(db, 'users'));
  const today = todayStr();
  let total = 0;
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.usage?.date === today) {
      total += data.usage.count || 0;
    }
  });
  return total;
}

const HEAVY_USAGE_THRESHOLD = 45;

export async function getHeavyUsageToday() {
  const snap = await getDocs(collection(db, 'users'));
  const today = todayStr();
  const flagged = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.usage?.date === today && (data.usage.count || 0) >= HEAVY_USAGE_THRESHOLD) {
      flagged.push({ uid: doc.id, count: data.usage.count });
    }
  });
  return flagged.sort((a, b) => b.count - a.count);
}
