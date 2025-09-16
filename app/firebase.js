import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvOkBH0R2L3aH-7CaOMZp8FqzG9nzGx6Y",
  authDomain: "financeiroon-5950c.firebaseapp.com",
  projectId: "financeiroon-5950c",
  storageBucket: "financeiroon-5950c.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);