const STORAGE_KEY = 'fintly-theme';

// Applies the theme by setting a data-attribute on <html>, which every CSS
// variable in index.css reacts to automatically — no per-component changes
// needed. Persisted in localStorage (not Firestore) since it's a pure
// device-level display preference, not account data, and this way it applies
// instantly on page load before any network request completes.
export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (e.g. private browsing) — theme just won't persist, non-fatal.
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
