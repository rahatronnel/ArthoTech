"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import { SavingsTransaction } from '@/lib/data';

type SavingsContextType = {
  savingsTransactions: SavingsTransaction[];
  addSavingsTransaction: (transaction: Omit<SavingsTransaction, 'id'>) => void;
};

const SavingsContext = createContext<SavingsContextType | undefined>(undefined);

export function SavingsProvider({ children }: { children: ReactNode }) {
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>([]);

  const addSavingsTransaction = (transaction: Omit<SavingsTransaction, 'id'>) => {
    const newTransaction: SavingsTransaction = {
        id: `ST${savingsTransactions.length + 1}`,
        ...transaction
    };
    setSavingsTransactions(prev => [...prev, newTransaction]);
  };

  return (
    <SavingsContext.Provider value={{ savingsTransactions, addSavingsTransaction }}>
      {children}
    </SavingsContext.Provider>
  );
}

export function useSavings() {
  const context = useContext(SavingsContext);
  if (context === undefined) {
    throw new Error('useSavings must be used within a SavingsProvider');
  }
  return context;
}
