
"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import type { Employee } from '@/lib/data';
import type { User } from 'firebase/auth';

// Mock Super Admin user
const mockSuperAdmin: Employee = {
  id: 'superadmin-001',
  code: 'SUPERADMIN',
  name: 'Super Admin',
  bengaliName: 'সুপার অ্যাডমিন',
  role: 'Super Admin',
  assignment: 'Head Office',
  loginId: 'superadmin',
};

type AuthContextType = {
  currentUser: Employee | null;
  firebaseUser: User | null; // This will be null
  loading: boolean;
  login: (loginId: string, password?: string) => Promise<void>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always return the mock user and set loading to false.
  const [currentUser] = useState<Employee | null>(mockSuperAdmin);
  const [loading] = useState(false);

  // Dummy functions since there's no real authentication
  const login = async () => { console.log("Login functionality removed."); };
  const logout = async () => { console.log("Logout functionality removed."); };
  const updatePassword = async () => { console.log("Password functionality removed.") };

  const value: AuthContextType = {
    currentUser,
    firebaseUser: null, // No real Firebase user
    loading,
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
