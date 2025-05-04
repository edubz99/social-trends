import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
// Corrected Firestore import for persistence
import {
  getFirestore,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
// Temporarily comment out App Check for debugging
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Ensure environment variables are being read correctly.
// Check for NEXT_PUBLIC_ prefix for client-side exposure.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Corrected storage bucket format (usually project-id.appspot.com)
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`
      : undefined),
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
// Only log on client-side where process.env is populated by Next.js
if (typeof window !== "undefined") {
  console.log("Firebase Config Used:", {
    apiKey: firebaseConfig.apiKey ? "********" : "MISSING/INVALID", // Don't log the actual key, check validity broadly
    authDomain: firebaseConfig.authDomain || "MISSING/INVALID",
    projectId: firebaseConfig.projectId || "MISSING/INVALID",
    storageBucket: firebaseConfig.storageBucket || "MISSING/DERIVED/INVALID",
    messagingSenderId: firebaseConfig.messagingSenderId || "MISSING/INVALID",
    appId: firebaseConfig.appId || "MISSING/INVALID",
    measurementId: firebaseConfig.measurementId || "MISSING/OPTIONAL",
  });
}

if (typeof window !== "undefined") {
  // Ensure this runs only on the client
  // Validate Firebase config more explicitly
  const missingVars = Object.entries(firebaseConfig)
    .filter(
      ([key, value]) =>
        // Allow measurementId to be optional
        key !== "measurementId" &&
        // Check for undefined/null/empty string or common placeholder patterns
        (!value ||
          value.startsWith("YOUR_") ||
          value.startsWith("PLACEHOLDER_") ||
          (key === "apiKey" && !value.startsWith("AIza"))) // Basic check for API key format
    )
    .map(
      ([key]) =>
        `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`
    ); // Format key name like NEXT_PUBLIC_FIREBASE_API_KEY

  if (missingVars.length > 0) {
    console.error(
      `Firebase configuration is incomplete or uses placeholder/example values. Missing or invalid environment variables: ${missingVars.join(
        ", "
      )}. ` +
        "Please check your .env file and ensure all NEXT_PUBLIC_FIREBASE_* variables are set correctly with your project credentials. " +
        "You can find these in your Firebase project settings (Project settings > General > Your apps > Firebase SDK snippet > Config)."
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

        // Temporarily disable App Check for debugging
        /*
        if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
          const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(
              process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
            ),
            isTokenAutoRefreshEnabled: true,
          });
          console.log("Firebase App Check initialized with reCAPTCHA v3");
        } else {
          console.warn(
            "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. App Check will not be initialized."
          );
        }
        */

        // Initialize services after ensuring app exists
        console.log("Attempting to get Auth instance for app:", app);
        auth = getAuth(app);
        console.log("Auth instance created:", auth);

        // Initialize Firestore with persistence
        try {
          db = initializeFirestore(app, {
            ignoreUndefinedProperties: true,
            localCache: persistentLocalCache({
              cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            }),
          });
          console.log("Firestore initialized with persistence");
        } catch (firestoreError) {
          console.error(
            "Error initializing Firestore with persistence:",
            firestoreError
          );
          db = getFirestore(app);
          console.log("Firestore initialized without persistence");
        }

        storage = getStorage(app);
        firebaseInitialized = true;
        console.log("All Firebase services initialized successfully");
      } else {
        app = getApp();
        console.log("Using existing Firebase app instance");
      }

      // Add a specific check/warning for auth/configuration-not-found
      console.warn(
        "Firebase Initialized: If you encounter 'auth/configuration-not-found' errors, " +
          "ensure you have enabled the necessary sign-in methods (e.g., Email/Password, Google) " +
          "in your Firebase project console (Authentication > Sign-in method)."
      );

      // Add warning for unauthorized domains
      console.warn(
        "Firebase Auth: If you encounter 'auth/unauthorized-domain' errors, ensure the current domain (e.g., localhost:xxxx, your deployed domain) is listed in the 'Authorized domains' " +
          "section under Firebase Console > Authentication > Settings."
      );

      // Add warning for Firestore Permission errors (often 400 Bad Request on Listen)
      console.warn(
        "Firestore: If you see 400 Bad Request errors on network requests to 'firestore.googleapis.com/.../Listen/channel' or 'PERMISSION_DENIED' errors in the console, " +
          "check your Firestore Security Rules in the Firebase Console. Ensure the rules allow the logged-in user to read the necessary documents (e.g., '/users/{userId}')."
      );
    } catch (error) {
      console.error("Error during Firebase initialization:", error);
      // Set dummy objects to prevent crashes
      app = {} as FirebaseApp;
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
    auth = auth || ({} as Auth);
    db = db || ({} as Firestore);
    storage = storage || ({} as FirebaseStorage);
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
