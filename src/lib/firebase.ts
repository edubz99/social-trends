
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Ensure environment variables are being read correctly.
// Check for NEXT_PUBLIC_ prefix for client-side exposure.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Corrected storage bucket format (usually project-id.appspot.com)
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com` : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Added measurementId
};

// Initialize Firebase App
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Flag to check if Firebase was initialized successfully
let firebaseInitialized = false;

if (typeof window !== 'undefined') { // Ensure this runs only on the client
    // Validate Firebase config more explicitly
    const missingVars = Object.entries(firebaseConfig)
      // Removed check for specific example API key prefix
      .filter(([key, value]) => key !== 'measurementId' && (!value || value.startsWith('YOUR_')))
      .map(([key]) => `NEXT_PUBLIC_${key.replace(/([A-Z])/g, '_$1').toUpperCase().replace('FIREBASE_','')}`); // Format key name

    if (missingVars.length > 0) {
        console.error(
            `Firebase configuration is incomplete or uses placeholder values. Missing or invalid environment variables: ${missingVars.join(', ')}. ` +
            'Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly with your project credentials. ' +
            'You can find these in your Firebase project settings (Project settings > General > Your apps > Firebase SDK snippet > Config).'
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
                 // Provide more context if possible
                 if ((e as Error).message?.includes('invalid-api-key') || (e as Error).message?.includes('api-key-not-valid')) {
                    console.error("The provided NEXT_PUBLIC_FIREBASE_API_KEY seems invalid. Please double-check it in your .env file and Firebase project settings.");
                 }
                 app = {} as FirebaseApp; // Assign dummy on error
            }
        } else {
            app = getApp();
            // Ensure services are initialized even if app already exists
             try {
                 // Check if services are already attached, otherwise get them
                 auth = getAuth(app);
                 db = getFirestore(app);
                 storage = getStorage(app);
                 if(!firebaseInitialized) console.log("Firebase services attached to existing app.");
                 firebaseInitialized = true;
              } catch (e) {
                  console.error("Error attaching Firebase services to existing app:", e);
                  firebaseInitialized = false;
                  auth = {} as Auth;
                  db = {} as Firestore;
                  storage = {} as FirebaseStorage;
              }
        }

        // Initialize services only if app initialization was successful and they aren't already initialized
        if (firebaseInitialized && (!auth || !db || !storage)) {
            try {
                // Use getAuth, getFirestore, getStorage which handle initialization safely
                auth = getAuth(app);
                db = getFirestore(app);
                storage = getStorage(app);
                 console.log("Firebase services initialized.");
                 firebaseInitialized = true;
            } catch (e) {
                console.error("Error initializing Firebase services:", e);
                // If service init fails (e.g., due to invalid config passed), reset flag and dummies
                firebaseInitialized = false;
                auth = {} as Auth;
                db = {} as Firestore;
                storage = {} as FirebaseStorage;
            }
        }
    }

    if (!firebaseInitialized) {
        console.warn(
           "Firebase is not properly initialized. App functionality requiring Firebase (Auth, Firestore, Storage) will not work. Check console errors for details on missing/invalid configuration."
        );
        // Ensure dummies are assigned if not initialized
        auth = auth || {} as Auth;
        db = db || {} as Firestore;
        storage = storage || {} as FirebaseStorage;
    }
} else {
    // Server-side: Provide dummies as client-side Firebase is expected for this setup.
    // Note: If using server-side Firebase Admin SDK, initialize it separately.
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
}


export { app, auth, db, storage, firebaseInitialized };
