
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase API Key or Project ID is missing. Check your environment variables (e.g., .env file). Make sure they are prefixed with NEXT_PUBLIC_');
  // Throwing an error might be too aggressive depending on the use case,
  // but it makes the issue explicit during development.
  // Consider logging instead for production builds if some parts of the app
  // can function without Firebase.
  // throw new Error("Firebase configuration is missing. See console for details.");
}


// Initialize Firebase
let app;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
    console.error("Failed to initialize Firebase:", error);
    // Handle the error appropriately - maybe show a message to the user
    // or fallback to a non-Firebase dependent state.
    // For now, we'll re-throw to make it obvious during development.
    // In a real app, you might want to create dummy instances or handle this gracefully.
    // throw error; // Uncomment if you want to halt execution on Firebase init failure
}


export { app, auth, db, storage };
