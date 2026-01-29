
"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/lib/data';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, updatePassword as fbUpdatePassword, User, createUserWithEmailAndPassword } from 'firebase/auth';

type AuthContextType = {
  currentUser: Employee | null;
  firebaseUser: User | null;
  loading: boolean;
  login: (loginId: string, password?: string) => Promise<void>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { user: firebaseUser, isUserLoading: isFirebaseUserLoading } = useUser();
  const auth = useFirebaseAuth();
  const firestore = useFirestore();
  const router = useRouter();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (firebaseUser) {
        setAuthLoading(true);
        const userDocRef = doc(firestore, 'employees', firebaseUser.uid);

        // This polling mechanism is crucial for handling the race condition during bulk user creation.
        // When a new user is created via createUserWithEmailAndPassword, onAuthStateChanged fires immediately,
        // but the Firestore document for the user's profile might not be created yet.
        // Instead of failing immediately, we poll for the document for a few seconds.
        const pollForDocument = async (retries: number, delay: number): Promise<boolean> => {
          for (let i = 0; i < retries; i++) {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              setCurrentUser({ id: docSnap.id, ...docSnap.data() } as Employee);
              return true;
            }
            // Wait before the next retry
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return false;
        };

        pollForDocument(5, 1000) // Poll 5 times, every 1 second (total 5 seconds)
          .then(found => {
            if (!found) {
              console.warn(`No employee profile found for user ${firebaseUser.uid} after multiple retries. This can happen if the user was deleted or during a failed bulk upload. Logging out.`);
              // If the profile is not found after polling, the user is invalid.
              setCurrentUser(null);
              // Also sign out from Firebase to clear the invalid auth state.
              signOut(auth);
            }
          })
          .finally(() => {
            setAuthLoading(false);
          });

      } else if (!isFirebaseUserLoading) {
        // If there's no firebaseUser and we are not in a loading state, there is no one logged in.
        setCurrentUser(null);
        setAuthLoading(false);
      }
    };

    fetchUserProfile();
  }, [firebaseUser, isFirebaseUserLoading, firestore, auth]);

  const login = async (loginId: string, password?: string): Promise<void> => {
    if (!password) {
      throw new Error("Password is required.");
    }
     if (!auth.app.options.authDomain) {
        throw new Error("Firebase auth domain is not configured. Cannot create email for login.");
    }
    // Emails are case-insensitive, so we normalize the loginId to lowercase.
    const normalizedLoginId = loginId.toLowerCase().trim();
    const email = `${normalizedLoginId}@${auth.app.options.authDomain}`;
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error("No user is logged in.");
    }
    if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
    }
    await fbUpdatePassword(auth.currentUser, newPassword);
  };

  const value: AuthContextType = {
    currentUser,
    firebaseUser,
    loading: isFirebaseUserLoading || authLoading,
    login,
    logout,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
