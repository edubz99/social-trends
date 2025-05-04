
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
// Corrected Firestore import for persistence
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
           (!value || value.startsWith('YOUR_') || value.startsWith('PLACEHOLDER_') || value.startsWith('AIzaSyC4UAODk-fZgpBml8aK88iqHrVLaXWnO-o')) // Check common placeholder/example API keys. **Important**: Remove the hardcoded key check if your actual key starts like this, but it's a strong indicator of a placeholder.
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

            // *** VERY IMPORTANT: App Check / reCAPTCHA Error Debugging ***
            // The error "authInstance._getRecaptchaConfig is not a function" STRONGLY indicates an issue with FIREBASE APP CHECK configuration.
            console.error(
                "*********************************************************************************\n" +
                "*** Firebase Auth/App Check Warning: Potential cause of login errors! ***\n" +
                "If you are seeing 'authInstance._getRecaptchaConfig is not a function' or similar reCAPTCHA errors:\n" +
                "1. Go to Firebase Console -> Project Settings -> App Check -> Apps tab.\n" +
                "2. Select your web app.\n" +
                "3. Verify 'reCAPTCHA v3' provider is configured with CORRECT Site Key and Secret Key from Google Cloud.\n" +
                "4. Ensure your domain(s) (e.g., localhost:xxxx, your deployed domain) are correctly registered in Google Cloud reCAPTCHA settings AND reflected in App Check.\n" +
                "5. Check if App Check is ENFORCED. If you don't need it, turn enforcement OFF. If you DO need it, ensure steps 3 & 4 are perfect.\n" +
                "*** Incorrect App Check setup is the most likely cause of this specific error. ***\n" +
                "*********************************************************************************"
             );

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
                // This specific check is redundant given the warning above, but kept for explicitness if error is thrown here.
                console.error(
                    "Firebase Auth Error related to reCAPTCHA ('_getRecaptchaConfig is not a function'). This is LIKELY an App Check configuration issue. " +
                    "Please check Firebase Console > Project Settings > App Check settings for your web app, including reCAPTCHA keys and site registration. See the detailed warning above."
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
