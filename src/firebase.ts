import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// IMPORTANT: keep your existing config here.
// If you already use import.meta.env.* variables, keep that style exactly.
// Replace the object below with YOUR current firebaseConfig if different.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Firestore offline cache:
 * - First load: normal
 * - Next loads: instant from IndexedDB, then sync in background
 */
enableIndexedDbPersistence(db).catch(() => {
  // Common reasons:
  // - Multiple tabs open
  // - Unsupported browser / private mode
  // Safe to ignore.
});