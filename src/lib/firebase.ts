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
  enableNetwork, disableNetwork
} from "firebase/firestore";
import { getStorage, FirebaseStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth as getFirebaseAuth, connectAuthEmulator } from "firebase/auth";


// Ensure environment variables are being read correctly.
// Check for NEXT_PUBLIC_ prefix for client-side exposure.
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
  console.log("Firebase Config Used:", {
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
      `Firebase configuration is incomplete or uses placeholder/example values. Missing or invalid environment variables: ${missingVars.join(', ')}. ` +
      'Please check your .env file or environment settings.'
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
        console.log("Firebase initialized successfully.");
      } else {
        app = getApp();
        console.log("Using existing Firebase app instance");
      }

      // Get Auth instance
      auth = getFirebaseAuth(app); // Use getAuth from 'firebase/auth'

      // Initialize Firestore with persistence
      try {
        db = initializeFirestore(app, {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
        });
        console.log("Firestore initialized with persistence enabled.");
        // Attempt to enable network explicitly after initialization to handle potential offline start
        enableNetwork(db).then(() => {
            console.log("Firestore network connection explicitly enabled.");
        }).catch((err) => {
             if (err instanceof FirestoreError && err.code === 'failed-precondition') {
                console.warn("Firestore: Could not enable network, possibly already enabled or another tab has persistence.");
            } else if (err instanceof FirestoreError && err.code === 'unimplemented') {
                 console.warn("Firestore: Persistent cache not available in this environment (e.g., server-side rendering). Offline support limited.");
            } else {
                console.error("Firestore: Error enabling network:", err);
            }
        });

      } catch (firestoreError: any) {
        console.error("Error initializing Firestore with persistence:", firestoreError);
        // Fallback to default initialization if persistence fails
        db = getFirestore(app);
        console.warn("Firestore initialized WITHOUT persistence due to error.");
      }

      // Get Storage instance
      storage = getStorage(app);

      // Connect to emulators if configured
      if (isEmulator) {
        console.log("Connecting to Firebase Emulators...");
        try {
            // Default ports: Auth 9099, Firestore 8080, Storage 9199
            connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectStorageEmulator(storage, 'localhost', 9199);
            console.log("Connected to Firebase Emulators (Auth:9099, Firestore:8080, Storage:9199)");
        } catch (emulatorError) {
             console.error("Error connecting to Firebase Emulators:", emulatorError);
             console.warn("Ensure Firebase Emulators are running. Run 'firebase emulators:start'.");
        }
      }

      firebaseInitialized = true;
      console.log("All Firebase services initialized for client.");

      // Add configuration warnings
       console.warn(
        "Firebase Auth Check: If you see 'auth/configuration-not-found', ensure Email/Password & Google sign-in methods are enabled in Firebase Console > Authentication > Sign-in method."
      );
       console.warn(
        "Firebase Auth Check: If you see 'auth/unauthorized-domain', ensure your domain (e.g., localhost:xxxx, socialhacks.app) is added in Firebase Console > Authentication > Settings > Authorized domains."
      );
       console.warn(
        "Firestore Rules Check: If you see Firestore permission errors (PERMISSION_DENIED or 400 Bad Request on Listen), verify your Firestore Security Rules allow reads/writes for logged-in users (e.g., /users/{userId})."
      );


    } catch (error: any) {
      console.error("CRITICAL Error during Firebase initialization:", error);
      if (error.message?.includes('invalid-api-key')) {
        console.error("Specific Error: Invalid API Key. Double-check NEXT_PUBLIC_FIREBASE_API_KEY.");
      }
      app = {} as FirebaseApp;
      auth = {} as Auth;
      db = {} as Firestore;
      storage = {} as FirebaseStorage;
      firebaseInitialized = false;
    }
  }

  if (!firebaseInitialized) {
    console.warn(
      "Firebase initialization FAILED. App functionality requiring Firebase will not work. Check console errors."
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

export { app, auth, db, storage, firebaseInitialized };
