import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  Firestore,
  initializeFirestore, // Keep for persistence setup
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
  FirestoreError,
  connectFirestoreEmulator,
  enableNetwork,
  terminate, // Keep terminate, might be useful for cleanup if needed, but avoid using it generally
  // No need for disableNetwork or clearIndexedDbPersistence generally
} from "firebase/firestore";
import { getStorage, FirebaseStorage, connectStorageEmulator } from "firebase/storage";


// Ensure environment variables are being read correctly.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Flag to check if Firebase was initialized successfully
let firebaseInitialized = false;
const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// This console log helps verify environment variables are loaded on the client
if (typeof window !== "undefined") {
  console.log("[Firebase] Config Used:", {
    apiKey: firebaseConfig.apiKey ? "********" : "MISSING/INVALID",
    authDomain: firebaseConfig.authDomain || "MISSING/INVALID",
    projectId: firebaseConfig.projectId || "MISSING/INVALID",
    storageBucket: firebaseConfig.storageBucket || "MISSING/INVALID",
    messagingSenderId: firebaseConfig.messagingSenderId || "MISSING/INVALID",
    appId: firebaseConfig.appId || "MISSING/INVALID",
    measurementId: firebaseConfig.measurementId || "MISSING/OPTIONAL",
    useEmulator: isEmulator,
  });
}

if (typeof window !== "undefined") {
  // Client-side initialization
  const missingVars = Object.entries(firebaseConfig)
    .filter(
      ([key, value]) =>
        key !== "measurementId" && // Allow measurementId to be optional
        (!value || value.includes("YOUR_") || value.includes("PLACEHOLDER_")) &&
        // Basic check for API key format if it's missing/placeholder
        !(key === "apiKey" && value && value.startsWith("AIza"))
    )
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`);

  if (missingVars.length > 0) {
    console.error(
      `[Firebase] CRITICAL: Configuration is incomplete or uses placeholder/example values. Missing or invalid environment variables: ${missingVars.join(', ')}. ` +
      'Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly with your project credentials. ' +
      'You can find these in your Firebase project settings (Project settings > General > Your apps > Firebase SDK snippet > Config).'
    );
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
    firebaseInitialized = false;
  } else {
    try {
      if (!getApps().length) {
        // Initialize App and Services ONLY ONCE
        app = initializeApp(firebaseConfig);
        console.log("[Firebase] App initialized successfully.");

        auth = getAuth(app);
        storage = getStorage(app);

        try {
          // Initialize Firestore WITH persistence settings ONLY when the app is first created
          db = initializeFirestore(app, {
              localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
              ignoreUndefinedProperties: true,
          });
          console.log("[Firebase] Firestore initialized with persistence.");

          // Attempt to enable network after initialization
          enableNetwork(db).then(() => {
              console.log("[Firebase] Firestore network explicitly enabled.");
          }).catch((err) => {
                if (err instanceof FirestoreError && err.code === 'failed-precondition') {
                  console.warn("[Firebase] Firestore: Network already enabled or persistence failed in another tab.");
                } else if (err instanceof FirestoreError && err.code === 'unimplemented') {
                    console.warn("[Firebase] Firestore: Persistent cache not available in this environment (e.g., server-side rendering). Offline support limited.");
                } else {
                  console.error("[Firebase] Firestore: Error enabling network:", err);
                }
          });

        } catch (firestoreError: any) {
            console.error("[Firebase] Error initializing Firestore with persistence:", firestoreError);
            // Fallback: get default instance without explicit persistence settings
            db = getFirestore(app);
            console.warn("[Firebase] Firestore initialized WITHOUT explicit persistence settings due to error.");
        }

        // Connect to emulators if configured (do this after service init)
        if (isEmulator) {
            console.log("[Firebase] Connecting to Emulators...");
            try {
                connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
                connectFirestoreEmulator(db, 'localhost', 8080);
                connectStorageEmulator(storage, 'localhost', 9199);
                console.log("[Firebase] Connected to Emulators (Auth:9099, Firestore:8080, Storage:9199).");
            } catch (emulatorError) {
                console.error("[Firebase] Error connecting to emulators:", emulatorError);
                console.warn("[Firebase] Ensure Firebase Emulators are running. Run 'firebase emulators:start'.");
            }
        }

      } else {
        // App already initialized, get existing instances
        app = getApp();
        auth = getAuth(app);
        storage = getStorage(app);
        // Get the already initialized Firestore instance (should retain persistence settings from initial call)
        db = getFirestore(app);
        console.log("[Firebase] Using existing Firebase app and service instances.");

        // Re-check network status when retrieving existing instance
        enableNetwork(db).catch((err) => {
             if (err instanceof FirestoreError && err.code === 'failed-precondition') {
                // This is expected if already enabled or another tab has persistence
             } else {
                console.warn("[Firebase] Firestore: Error trying to enable network on existing instance:", err);
             }
        });
      }

      firebaseInitialized = true;
      console.log("[Firebase] Initialization check complete.");

      // Add configuration warnings
       console.warn(
        "[Firebase] Auth Check: If you see 'auth/configuration-not-found', ensure Email/Password & Google sign-in methods are enabled in Firebase Console > Authentication > Sign-in method."
      );
       console.warn(
        "[Firebase] Auth Check: If you see 'auth/unauthorized-domain', ensure your domain (e.g., localhost:9002, your-production-domain.app) is added in Firebase Console > Authentication > Settings > Authorized domains."
      );
       console.warn(
        "[Firebase] Firestore Rules Check: If you see Firestore permission errors (PERMISSION_DENIED or 400 Bad Request on Listen), verify your Firestore Security Rules allow reads/writes for logged-in users (e.g., /users/{userId})."
      );
       // Warning about App Check / reCAPTCHA
       console.warn(
        "[Firebase] App Check / reCAPTCHA: If you encounter 'authInstance._getRecaptchaConfig is not a function', ensure Firebase App Check is correctly configured (or disabled) in the Firebase/Google Cloud Console for your project. Mismatched configurations can cause authentication failures."
       );


    } catch (error: any) {
      console.error("[Firebase] CRITICAL Error during Firebase initialization:", error);
      if (error.message?.includes('invalid-api-key')) {
        console.error("[Firebase] Specific Error: Invalid API Key. Double-check NEXT_PUBLIC_FIREBASE_API_KEY.");
      }
      app = {} as FirebaseApp;
      auth = {} as Auth;
      db = {} as Firestore;
      storage = {} as FirebaseStorage;
      firebaseInitialized = false;
    }
  }

  if (!firebaseInitialized) {
    console.error( // Changed to error for more visibility
      "[Firebase] CRITICAL: Firebase initialization FAILED. App functionality requiring Firebase will not work. Check console errors above for details (missing config, invalid keys, etc.)."
    );
    // Ensure dummies are assigned if initialization failed
    app = app || ({} as FirebaseApp); // Ensure app is assigned even if error occurred before assignment
    auth = auth || ({} as Auth);
    db = db || ({} as Firestore);
    storage = storage || ({} as FirebaseStorage);
  }
} else {
  // Server-side: Firebase client SDK not initialized here.
  // If needed, use Firebase Admin SDK separately in server components/functions.
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
  firebaseInitialized = false; // Explicitly false on server
}

// Helper function to check network status (can be used in components)
const isFirestoreOnline = async (): Promise<boolean> => {
  if (!firebaseInitialized || !db) return false;
  try {
    // Attempt to re-enable network. If it resolves, we're likely online or can go online.
    // If it rejects with 'unavailable', we are likely offline.
    await enableNetwork(db);
    return true;
  } catch (error) {
    if (error instanceof FirestoreError && error.code === 'unavailable') {
      return false;
    }
    // Assume online for other errors, or rethrow if needed
    console.warn("[Firebase] Error checking Firestore network status:", error);
    return true; // Or false, depending on desired behavior for unknown errors
  }
};


export { app, auth, db, storage, firebaseInitialized, isFirestoreOnline };
