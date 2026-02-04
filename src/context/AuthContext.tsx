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
      if (!firestore) return;
      // This temporary app instance allows us to attempt user creation without affecting the main app's auth state.
      const tempApp = initializeApp(firebaseConfig, `superadmin-creation-${Date.now()}`);
      const tempAuth = getAuth(tempApp);
      try {
        // Attempt to create the superadmin auth user. This will only succeed if it doesn't exist.
        const userCredential = await createUserWithEmailAndPassword(tempAuth, "superadmin@example.com", "abc123");
        const uid = userCredential.user.uid;
        
        console.log("Super Admin auth user was missing, recreating now...");

        // Check for an existing Firestore document for the superadmin
        const q = query(collection(firestore, "employees"), where("email", "==", "superadmin@example.com"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // If a doc exists, update its UID to match the newly created auth user.
            const docRef = querySnapshot.docs[0].ref;
            await setDoc(docRef, { uid: uid }, { merge: true });
            console.log("Super Admin's Firestore document has been updated with the new UID.");
        } else {
            // If no doc exists, create one.
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
            console.log("New Super Admin record created in Firestore.");
        }
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          // This is the expected, normal case where the user already exists. Do nothing.
          console.log("Super Admin auth user verified. Self-healing not needed.");
        } else {
          // Log any other unexpected errors during the self-healing process.
          console.error("An unexpected error occurred during Super Admin self-healing:", error);
        }
      } finally {
        // Clean up the temporary app instance.
        await deleteApp(tempApp);
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
            const employeeData = { id: employeeDoc.id, ...employeeDoc.data() } as Employee;
            
            if (employeeData.disabled) {
                console.warn(`User ${user.uid} (${user.email}) is disabled. Forcing logout.`);
                await signOut(auth);
            } else {
                setCurrentUser(employeeData);
            }
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
