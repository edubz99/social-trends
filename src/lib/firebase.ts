
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
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com` : undefined),
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
      .filter(([key, value]) =>
          // Allow measurementId to be optional
          key !== 'measurementId' &&
          // Check for undefined/null/empty string or common placeholder patterns
          (!value || value.startsWith('YOUR_') || (key === 'apiKey' && value.startsWith('AIzaSyC4UAODk-fZgpBml8aK88iqHrVLaXWnO-o'))) // Check specific placeholder API key
      )
      .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`); // Format key name like NEXT_PUBLIC_FIREBASE_API_KEY


    if (missingVars.length > 0) {
        console.error(
            `Firebase configuration is incomplete or uses placeholder/example values. Missing or invalid environment variables: ${missingVars.join(', ')}. ` +
            'Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly with your project credentials. ' +
            'You can find these in your Firebase project settings (Project settings > General > Your apps > Firebase SDK snippet > Config).'
        );
        // Set dummy objects to prevent hard crashes, but Firebase will not work
        app = {} as FirebaseApp;
        auth = {} as Auth;
        db = {} as Firestore;
        storage = {} as FirebaseStorage;
        firebaseInitialized = false;
    } else {
        try {
            if (!getApps().length) {
                app = initializeApp(firebaseConfig);
                console.log("Firebase initialized successfully.");
            } else {
                app = getApp();
                 console.log("Using existing Firebase app instance.");
            }
             // Initialize services after ensuring app exists
            auth = getAuth(app);
            db = getFirestore(app);
            storage = getStorage(app);
            firebaseInitialized = true;
            console.log("Firebase services initialized/attached.");

            // Add a specific check/warning for auth/configuration-not-found
            console.warn(
              "Firebase Initialized: If you encounter 'auth/configuration-not-found' errors, " +
              "ensure you have enabled the necessary sign-in methods (e.g., Email/Password, Google) " +
              "in your Firebase project console (Authentication > Sign-in method)."
            );

        } catch (e) {
             console.error("Firebase initialization or service attachment error:", e);
             // Provide more context if possible
             if ((e as Error).message?.includes('invalid-api-key') || (e as Error).message?.includes('api-key-not-valid')) {
                console.error("The provided NEXT_PUBLIC_FIREBASE_API_KEY seems invalid. Please double-check it in your .env file and Firebase project settings.");
             } else if ((e as Error).message?.includes('auth/configuration-not-found')) {
                 console.error(
                    "Firebase Auth Error: 'auth/configuration-not-found'. This usually means the Email/Password (or other) " +
                    "sign-in provider is not enabled in your Firebase project console. Go to Authentication > Sign-in method and enable it."
                 );
             }
             app = {} as FirebaseApp; // Assign dummy on error
             auth = {} as Auth;
             db = {} as Firestore;
             storage = {} as FirebaseStorage;
             firebaseInitialized = false;
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
    firebaseInitialized = false; // Explicitly false on server
}


export { app, auth, db, storage, firebaseInitialized };
