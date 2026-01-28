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

  // Seed a default Super Admin if one doesn't exist.
  useEffect(() => {
    const seedSuperAdmin = async () => {
      if (!firestore || !auth || !auth.app.options.authDomain) {
          // Firebase services aren't ready, or config is missing.
          if (!auth?.app.options.authDomain) {
              console.error("Cannot seed admin: authDomain is not available in Firebase config.");
          }
          return;
      }
      
      const loginId = 'superadmin';
      const password = 'bbb';
      const email = `${loginId}@${auth.app.options.authDomain}`;

      try {
        // This will create the user and sign them in.
        // It will fail with 'auth/email-already-in-use' if the user exists, which is expected.
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        console.log("No Super Admin found. Seeding new admin account...");

        const adminEmployee: Omit<Employee, 'id'> = {
          name: 'Super Admin',
          bengaliName: 'সুপার অ্যাডমিন',
          code: 'SADMIN-001',
          role: 'Super Admin',
          assignment: 'Head Office',
          loginId: loginId,
        };
        
        // Because createUser... signs the user in, this setDoc is allowed by the `isSignedIn()` rule.
        await setDoc(doc(firestore, "employees", uid), adminEmployee);
        
        // Sign out the newly created admin so the user has to login manually.
        await signOut(auth);

        console.log('Super Admin seeded successfully. You can now log in with Login ID: "superadmin" and Password: "bbb"');

      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // This is the expected "error" on subsequent loads, means admin exists.
          console.log('Admin user already exists. Skipping seeding.');
        } else {
          // Log other, unexpected errors during the seeding process.
          console.error('Error during admin seeding:', authError);
        }
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
