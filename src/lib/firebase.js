import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAFyDgcMpKrOufB7FiQsP98d56Nz3X4IhU',
  authDomain: 'fintly-ai-agent.firebaseapp.com',
  projectId: 'fintly-ai-agent',
  storageBucket: 'fintly-ai-agent.firebasestorage.app',
  messagingSenderId: '836551411826',
  appId: '1:836551411826:web:7fc9468b8c2bdbed0f1aeb',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Popups are unreliable on mobile browsers (often silently blocked or never resolve).
// Use redirect-based sign-in on mobile, and popup on desktop for a smoother experience.
export function loginWithGoogle() {
  if (isMobileDevice()) {
    return signInWithRedirect(auth, googleProvider);
  }
  return signInWithPopup(auth, googleProvider);
}

export function checkRedirectResult() {
  return getRedirectResult(auth);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
