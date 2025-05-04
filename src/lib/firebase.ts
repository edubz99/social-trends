
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Flag to check if Firebase was initialized successfully
let firebaseInitialized = false;

if (typeof window !== 'undefined') { // Ensure this runs only on the client
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error(
            'Firebase API Key or Project ID is missing. Check your environment variables (e.g., .env file). ' +
            'Make sure they are prefixed with NEXT_PUBLIC_ and that the .env file is correctly loaded.'
        );
        // Set dummy objects to prevent hard crashes, but Firebase will not work
        app = {} as FirebaseApp;
        auth = {} as Auth;
        db = {} as Firestore;
        storage = {} as FirebaseStorage;
    } else {
        if (!getApps().length) {
            try {
                app = initializeApp(firebaseConfig);
                firebaseInitialized = true;
                console.log("Firebase initialized successfully.");
            } catch (e) {
                 console.error("Firebase initialization error:", e);
                 app = {} as FirebaseApp; // Assign dummy on error
            }
        } else {
            app = getApp();
            firebaseInitialized = true; // Already initialized
        }

        // Initialize services only if app initialization was potentially successful
        if (firebaseInitialized) {
            try {
                auth = getAuth(app);
                db = getFirestore(app);
                storage = getStorage(app);
            } catch (e) {
                console.error("Error initializing Firebase services:", e);
                // If service init fails (e.g., due to invalid config passed), reset flag and dummies
                firebaseInitialized = false;
                auth = {} as Auth;
                db = {} as Firestore;
                storage = {} as FirebaseStorage;
            }
        } else {
             auth = {} as Auth;
             db = {} as Firestore;
             storage = {} as FirebaseStorage;
        }
    }

    if (!firebaseInitialized) {
        console.warn(
           "Firebase is not initialized. Ensure your NEXT_PUBLIC_FIREBASE_* environment variables are set correctly in your .env file."
        );
    }
} else {
    // Server-side: You might need a different initialization (e.g., Admin SDK)
    // or simply provide dummies if client-side Firebase is expected.
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
}


export { app, auth, db, storage, firebaseInitialized };
