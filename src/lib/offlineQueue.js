const QUEUE_KEY = 'fintly-offline-queue';

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — queueing is best-effort only.
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function queueMessage({ conversationId, text }) {
  const queue = readQueue();
  queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, conversationId, text, queuedAt: Date.now() });
  writeQueue(queue);
}

export function getQueuedMessages() {
  return readQueue();
}

export function removeQueuedMessage(id) {
  writeQueue(readQueue().filter((m) => m.id !== id));
}

export function clearQueue() {
  writeQueue([]);
}

export function onBackOnline(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
