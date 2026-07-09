const PENDING_REF_KEY = 'fintly-pending-referral';

export function capturePendingReferral() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem(PENDING_REF_KEY, ref);
    }
  } catch {
    // non-fatal
  }
}

export function getPendingReferral() {
  try {
    return localStorage.getItem(PENDING_REF_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  try {
    localStorage.removeItem(PENDING_REF_KEY);
  } catch {
    // non-fatal
  }
}
