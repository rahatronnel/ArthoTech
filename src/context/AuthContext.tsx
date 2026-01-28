
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
        
        // Attempt to get the user document.
        let userDoc = await getDoc(userDocRef);

        // If the document doesn't exist, it might be a race condition during bulk upload.
        // Wait a short period and try one more time.
        if (!userDoc.exists()) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
            userDoc = await getDoc(userDocRef); // Retry fetching
        }

        if (userDoc.exists()) {
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as Employee);
        } else {
          // If the profile still doesn't exist after the retry, it's a genuine issue.
          // The user might have been deleted from the DB but not from Auth.
          // Set to null, which will trigger a logout for security.
          console.warn(`No employee profile found for user ${firebaseUser.uid}, even after retry. Logging out.`);
          setCurrentUser(null);
        }
        setAuthLoading(false);
      } else if (!isFirebaseUserLoading) {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    };

    fetchUserProfile();
  }, [firebaseUser, isFirebaseUserLoading, firestore]);

  const login = async (loginId: string, password?: string): Promise<void> => {
    if (!password) {
      throw new Error("Password is required.");
    }
     if (!auth.app.options.authDomain) {
        throw new Error("Firebase auth domain is not configured. Cannot create email for login.");
    }
    // This assumes the user's email is formatted as loginId@<auth-domain>
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

    