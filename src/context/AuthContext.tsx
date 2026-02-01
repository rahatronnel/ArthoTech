"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/lib/data';
import type { User } from 'firebase/auth';
import { useFirebase } from '@/firebase/provider';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';


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
    
    const ensureSuperAdminExists = async () => {
      const q = query(collection(firestore, "employees"), where("email", "==", "superadmin@example.com"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("Super Admin not found in Firestore, attempting to create...");
        const tempApp = initializeApp(firebaseConfig, `superadmin-creation-${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        try {
          const userCredential = await createUserWithEmailAndPassword(tempAuth, "superadmin@example.com", "abc123");
          const uid = userCredential.user.uid;
          
          const newDocRef = doc(collection(firestore, "employees"));
          const newEmployee: Employee = {
              id: newDocRef.id,
              uid: uid,
              email: "superadmin@example.com",
              name: "Super Admin",
              bengaliName: "সুপার অ্যাডমিন",
              code: "S_ADMIN",
              role: 'Super Admin',
              assignment: 'Head Office',
          };
          await setDoc(newDocRef, newEmployee);
          console.log("Super Admin user created successfully.");
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            console.log("Super Admin auth user already exists but Firestore record was missing. This is an inconsistent state and may require manual resolution if login fails.");
          } else {
            console.error("Failed to create Super Admin user:", error);
          }
        } finally {
          await deleteApp(tempApp);
        }
      }
    };

    ensureSuperAdminExists();

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
