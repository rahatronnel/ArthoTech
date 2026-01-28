"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/lib/data';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { doc, getDoc, collection, query, limit, getDocs, setDoc } from 'firebase/firestore';
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

  // Seed a default Super Admin if no employees exist in the database.
  useEffect(() => {
    const seedSuperAdmin = async () => {
      if (!firestore || !auth) return;

      const employeesQuery = query(collection(firestore, 'employees'), limit(1));
      
      try {
        const snapshot = await getDocs(employeesQuery);
        
        if (snapshot.empty) {
          console.log("No employees found. Seeding Super Admin...");
          const loginId = 'admin';
          const password = 'password';
          const authDomain = auth.app.options.authDomain;
          if (!authDomain) {
            console.error("Cannot seed admin: authDomain is not available.");
            return;
          }
          const email = `${loginId}@${authDomain}`;

          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            const adminEmployee: Omit<Employee, 'id'> = {
              name: 'Super Admin',
              bengaliName: 'সুপার অ্যাডমিন',
              code: 'ADMIN-001',
              role: 'Super Admin',
              assignment: 'Head Office',
              loginId: loginId,
            };
            
            await setDoc(doc(firestore, "employees", uid), adminEmployee);
            
            // Sign out the newly created admin so the user has to login manually.
            await signOut(auth);

            console.log('Super Admin seeded successfully. You can now log in with Login ID: "admin" and Password: "password"');
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              console.log('Admin user already exists in Firebase Auth. Skipping seeding.');
            } else {
              console.error('Error creating admin user in Auth:', authError);
            }
          }
        }
      } catch (firestoreError) {
        console.error('Error checking for existing employees in Firestore:', firestoreError);
      }
    };

    // Run the check only once after the initial auth state has been determined and if no user is logged in.
    if (isFirebaseUserLoading === false && !firebaseUser) {
      seedSuperAdmin();
    }
  }, [isFirebaseUserLoading, firebaseUser, firestore, auth, router]);

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
    const email = `${loginId}@${auth.app.options.authDomain}`;
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
