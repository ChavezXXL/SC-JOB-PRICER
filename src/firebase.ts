import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCY9GRaiuD6hZvsKXw8v7D0lcuewPsk6J0",
  authDomain: "sc-job-pricer.firebaseapp.com",
  projectId: "sc-job-pricer",
  storageBucket: "sc-job-pricer.firebasestorage.app",
  messagingSenderId: "631603638387",
  appId: "1:631603638387:web:270abed514dbb2de5afa06"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
