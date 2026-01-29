
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
};

type AuthContextType = {
  currentUser: Employee | null;
  firebaseUser: User | null; // This will be null
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always return the mock user and set loading to false.
  const [currentUser] = useState<Employee | null>(mockSuperAdmin);
  const [loading] = useState(false);

  const value: AuthContextType = {
    currentUser,
    firebaseUser: null, // No real Firebase user
    loading,
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
