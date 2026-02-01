"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/lib/data';
import type { User } from 'firebase/auth';
import { useFirebase } from '@/firebase/provider';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';


type AuthContextType = {
  currentUser: Employee | null;
  firebaseUser: User | null;
  loading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { auth, firestore } = useFirebase();

  useEffect(() => {
    if (!auth || !firestore) {
        setLoading(false);
        return;
    };
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // User is signed in, find their employee data.
        const q = query(collection(firestore, "employees"), where("uid", "==", user.uid));
        try {
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const employeeDoc = querySnapshot.docs[0];
            setCurrentUser({ id: employeeDoc.id, ...employeeDoc.data() } as Employee);
          } else {
            console.warn(`No employee document found for authenticated user ${user.uid}`);
            setCurrentUser(null);
            await signOut(auth); // Log out user if no employee profile
          }
        } catch (error) {
           console.error("Error fetching employee document:", error);
           setCurrentUser(null);
           await signOut(auth);
        }
      } else {
        // User is signed out.
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);
  
  const logout = async () => {
    if (auth) {
        await signOut(auth);
        setCurrentUser(null);
        setFirebaseUser(null);
        router.push('/login');
    }
  };

  const value: AuthContextType = {
    currentUser,
    firebaseUser,
    loading,
    logout,
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

    