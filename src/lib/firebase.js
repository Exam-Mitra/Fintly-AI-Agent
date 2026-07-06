// Firebase setup — Authentication (Google + Email/Password) and Firestore (chat history).
// This project is free at this scale: unlimited free Auth, and Firestore's free tier
// (1GB storage, 50K reads/day, 20K writes/day) comfortably covers personal + early public use.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
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
