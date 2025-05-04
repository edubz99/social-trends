
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
// Updated imports for Firestore v9+ persistence
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
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

// This console log helps verify environment variables are loaded on the client
console.log("Firebase Config Used:", {
    apiKey: firebaseConfig.apiKey ? '********' : 'MISSING', // Don't log the actual key
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    measurementId: firebaseConfig.measurementId,
});


if (typeof window !== 'undefined') { // Ensure this runs only on the client
    // Validate Firebase config more explicitly
    const missingVars = Object.entries(firebaseConfig)
      .filter(([key, value]) =>
          // Allow measurementId to be optional
          key !== 'measurementId' &&
          // Check for undefined/null/empty string or common placeholder patterns
          (!value || value.startsWith('YOUR_') || value.startsWith('PLACEHOLDER_') || value.startsWith('AIza')) // Check for common placeholder/example API key starts
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
             // Initialize Firestore with persistence enabled using persistentLocalCache
            db = initializeFirestore(app, {
                ignoreUndefinedProperties: true, // Optional: Recommended for consistency
                localCache: persistentLocalCache({cacheSizeBytes: CACHE_SIZE_UNLIMITED}) // Enable offline persistence
                // Use persistentMultipleTabCache if needed: persistentMultipleTabCache(/* optional config */)
            });
            console.log("Firestore initialized with offline persistence enabled (using persistentLocalCache).");


            storage = getStorage(app);
            firebaseInitialized = true;
            console.log("Firebase services initialized/attached.");

            // Add a specific check/warning for auth/configuration-not-found
            console.warn(
              "Firebase Initialized: If you encounter 'auth/configuration-not-found' errors, " +
              "ensure you have enabled the necessary sign-in methods (e.g., Email/Password, Google) " +
              "in your Firebase project console (Authentication > Sign-in method). Also ensure your domain is authorized (Authentication > Settings > Authorized domains)."
            );

             // Add warning for App Check issues causing recaptcha errors
             console.warn(
                "Firebase Auth: If you encounter '_getRecaptchaConfig is not a function' or similar errors, " +
                "it might relate to App Check. Ensure App Check is correctly configured for your web app in the Firebase Console " +
                "(Project Settings > App Check > Apps), including registering the reCAPTCHA keys."
             );
             // Add warning for unauthorized domains
            console.warn(
                 "Firebase Auth: If you encounter 'auth/unauthorized-domain' errors, ensure the current domain (e.g., localhost, your deployed domain) is listed in the 'Authorized domains' " +
                 "section under Firebase Console > Authentication > Settings."
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
             } else if ((e as Error).message?.includes('_getRecaptchaConfig is not a function')) {
                console.error(
                    "Firebase Auth Error related to reCAPTCHA. This might indicate an issue with App Check configuration in your Firebase project. " +
                    "If using App Check, ensure it's correctly set up for your web app (Project Settings > App Check > Apps). " +
                    "If not intentionally using App Check, this might be an internal SDK issue or conflict."
                 );
             } else if ((e as Error).message?.includes('auth/unauthorized-domain')) {
                 console.error(
                     "Firebase Auth Error: 'auth/unauthorized-domain'. The current domain is not authorized for OAuth operations. " +
                     "Go to the Firebase Console > Authentication > Settings > Authorized domains and add your application's domain(s) (e.g., localhost, your-deployed-domain.com)."
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
