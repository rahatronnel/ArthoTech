
"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import { SavingsTransaction } from '@/lib/data';

type SavingsContextType = {
  savingsTransactions: SavingsTransaction[];
  addSavingsTransaction: (transaction: Omit<SavingsTransaction, 'id'>) => void;
  deleteSavingsByDate: (date: string) => void;
  deleteAllSavings: () => void;
};

const SavingsContext = createContext<SavingsContextType | undefined>(undefined);

export function SavingsProvider({ children }: { children: ReactNode }) {
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>([]);

  const addSavingsTransaction = (transaction: Omit<SavingsTransaction, 'id'>) => {
    const newTransaction: SavingsTransaction = {
        id: `ST-${Date.now()}-${Math.random()}`,
        ...transaction
    };
    setSavingsTransactions(prev => [...prev, newTransaction]);
  };

  const deleteSavingsByDate = (date: string) => {
    setSavingsTransactions(prev => prev.filter(t => t.date !== date));
  };

  const deleteAllSavings = () => {
    setSavingsTransactions([]);
  };


  return (
    <SavingsContext.Provider value={{ savingsTransactions, addSavingsTransaction, deleteSavingsByDate, deleteAllSavings }}>
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
