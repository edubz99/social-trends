import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
// Corrected Firestore import for persistence
import {
  getFirestore,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
  FirestoreError,
  connectFirestoreEmulator, // Import for emulator connection
  enableNetwork,
  disableNetwork, // Added disableNetwork
  terminate, // Added terminate for potential cleanup
  clearIndexedDbPersistence, // Added for debugging persistence issues
} from "firebase/firestore";
import { getStorage, FirebaseStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth as getFirebaseAuth, connectAuthEmulator } from "firebase/auth";


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
        app = initializeApp(firebaseConfig);
        console.log("[Firebase] App initialized successfully.");
      } else {
        app = getApp();
        console.log("[Firebase] Using existing Firebase app instance");
      }

      // Get Auth instance
      auth = getFirebaseAuth(app); // Use getAuth from 'firebase/auth'

      // Initialize Firestore with persistence
      try {
        // Check if Firestore instance already exists for this app
        // Note: getFirestore() without args might cause issues if multiple apps exist
        try {
            db = getFirestore(app);
            // Terminate existing instance if needed, especially for re-init with persistence
            // await terminate(db);
            // console.log("[Firebase] Terminated existing Firestore instance before re-initializing with persistence.");
            console.log("[Firebase] Using existing Firestore instance.");
        } catch (e) {
            console.log("[Firebase] No existing Firestore instance found, initializing new one.");
        }

        // Initialize with persistence settings
        // Use initializeFirestore ONLY if you need specific settings like persistence.
        // If just getting the default instance, getFirestore(app) is enough.
        // Let's assume persistence is desired:
        db = initializeFirestore(app, {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
          // experimentalAutoDetectLongPolling: true, // Optional: May help in some network environments
        });
        console.log("[Firebase] Firestore initialized with persistent cache settings.");

        // Attempt to enable network explicitly after initialization to handle potential offline start
        enableNetwork(db).then(() => {
            console.log("[Firebase] Firestore network connection explicitly enabled.");
        }).catch((err) => {
             if (err instanceof FirestoreError && err.code === 'failed-precondition') {
                console.warn("[Firebase] Firestore: Could not enable network, possibly already enabled or another tab has persistence.");
            } else if (err instanceof FirestoreError && err.code === 'unimplemented') {
                 console.warn("[Firebase] Firestore: Persistent cache not available in this environment (e.g., server-side rendering). Offline support limited.");
            } else {
                console.error("[Firebase] Firestore: Error enabling network:", err);
            }
        });

      } catch (firestoreError: any) {
        console.error("[Firebase] Error initializing Firestore with persistence:", firestoreError);
        if (firestoreError instanceof FirestoreError && firestoreError.code === 'failed-precondition') {
             console.error("[Firebase] Firestore failed precondition - This often means another tab has persistence enabled or there was an issue initializing the cache. Trying fallback...");
             // Attempt to clear persistence - USE WITH CAUTION IN PRODUCTION
             // clearIndexedDbPersistence(db).then(() => {
             //     console.log("[Firebase] Cleared IndexedDB persistence. Reloading might be required.");
             // }).catch(clearErr => {
             //     console.error("[Firebase] Failed to clear IndexedDB persistence:", clearErr);
             // });
        }
        // Fallback to default initialization if persistence fails
        db = getFirestore(app); // Get default instance
        console.warn("[Firebase] Firestore initialized WITHOUT explicit persistence settings due to error.");
      }

      // Get Storage instance
      storage = getStorage(app);

      // Connect to emulators if configured
      if (isEmulator) {
        console.log("[Firebase] Connecting to Firebase Emulators...");
        try {
            // Default ports: Auth 9099, Firestore 8080, Storage 9199
            connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectStorageEmulator(storage, 'localhost', 9199);
            console.log("[Firebase] Connected to Firebase Emulators (Auth:9099, Firestore:8080, Storage:9199)");
        } catch (emulatorError) {
             console.error("[Firebase] Error connecting to Firebase Emulators:", emulatorError);
             console.warn("[Firebase] Ensure Firebase Emulators are running. Run 'firebase emulators:start'.");
        }
      }

      firebaseInitialized = true;
      console.log("[Firebase] All Firebase services initialized for client.");

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
