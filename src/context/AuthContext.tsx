"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { employees as initialEmployees, Employee } from '@/lib/data';

type AuthContextType = {
  currentUser: Employee | null;
  loading: boolean;
  login: (loginId: string, password?: string) => Promise<void>;
  logout: () => void;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // In a real app, you might check for a session here
    setLoading(false);
  }, []);

  const login = (loginId: string, password?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const user = employees.find(e => e.loginId === loginId);
      if (user && user.password === password) {
        setCurrentUser(user);
        resolve();
      } else {
        reject(new Error('Invalid login ID or password.'));
      }
    });
  };

  const logout = () => {
    setCurrentUser(null);
    router.push('/login');
  };
  
  const updatePassword = (currentPassword: string, newPassword: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!currentUser) {
        return reject(new Error("No user is logged in."));
      }

      if (currentUser.password !== currentPassword) {
        return reject(new Error("Incorrect current password."));
      }
      
      const updatedUser = { ...currentUser, password: newPassword };
      setCurrentUser(updatedUser);

      setEmployees(prevEmployees => 
        prevEmployees.map(emp => emp.id === currentUser.id ? updatedUser : emp)
      );

      resolve();
    });
  };

  const value = { currentUser, loading, login, logout, updatePassword };

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
