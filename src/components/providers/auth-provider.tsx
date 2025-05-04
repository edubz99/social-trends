
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseInitialized } from '@/lib/firebase'; // Import firebaseInitialized

interface AuthContextProps {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined = undefined;

    if (firebaseInitialized) {
        // Only subscribe if Firebase is initialized
        unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        }, (error) => {
            // Handle potential errors during auth state listening
            console.error("Auth state change error:", error);
            setUser(null);
            setLoading(false);
        });
    } else {
        // If Firebase is not initialized, set loading to false immediately
        console.warn("AuthProvider: Firebase not initialized, skipping auth state listener.");
        setLoading(false);
    }


    // Cleanup subscription on unmount
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, []); // Dependency array remains empty as we check firebaseInitialized internally

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
