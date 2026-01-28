"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/lib/data';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, updatePassword as fbUpdatePassword, User } from 'firebase/auth';

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
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as Employee);
        } else {
          setCurrentUser(null);
          console.warn(`No employee profile found for user ${firebaseUser.uid}`);
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
    // This assumes the user's email is formatted as loginId@<auth-domain>
    // This is a workaround as we don't store emails, only login IDs.
    const email = `${loginId}@${auth.app.options.authDomain}`;
    await signInWithEmailAndPassword(auth, email, password);
    // The useEffect hook will handle fetching the user profile from Firestore.
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error("No user is logged in.");
    }
    // Note: Firebase's updatePassword requires the user to have signed in recently.
    // If this fails, the user may need to log out and log back in.
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
