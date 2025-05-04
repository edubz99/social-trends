
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

// Initialize Firebase App
let app: ReturnType<typeof initializeApp>;
if (!getApps().length) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error('Firebase API Key or Project ID is missing. Check your environment variables (e.g., .env file). Make sure they are prefixed with NEXT_PUBLIC_');
        // Set app to a dummy object or handle appropriately if Firebase is optional
        // For now, we'll let it proceed, but auth/db calls will fail later.
        app = {} as ReturnType<typeof initializeApp>; // Avoid hard crash, let downstream fail
    } else {
        app = initializeApp(firebaseConfig);
    }
} else {
    app = getApp();
}


// Initialize Firebase services only if the app was initialized correctly
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;

// Check if app object looks like a valid Firebase app (basic check)
if (app && app.options && app.options.apiKey) {
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} else {
    console.warn("Firebase app initialization failed or skipped due to missing config. Firebase services will not be available.");
    // Provide dummy instances or null to prevent crashes if services are accessed
    auth = {} as ReturnType<typeof getAuth>;
    db = {} as ReturnType<typeof getFirestore>;
    storage = {} as ReturnType<typeof getStorage>;
}


export { app, auth, db, storage };
