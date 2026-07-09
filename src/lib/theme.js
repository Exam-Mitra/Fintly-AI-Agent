const STORAGE_KEY = 'fintly-theme';

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
