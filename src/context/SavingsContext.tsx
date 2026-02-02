"use client";

import { createContext, useContext, ReactNode } from 'react';
import { SavingsTransaction } from '@/lib/data';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type SavingsContextType = {
  savingsTransactions: SavingsTransaction[];
  isLoading: boolean;
  addSavingsTransaction: (transaction: Omit<SavingsTransaction, 'id'>) => Promise<void>;
  deleteSavingsByDate: (date: string) => Promise<void>;
  deleteAllSavings: () => Promise<void>;
};

const SavingsContext = createContext<SavingsContextType | undefined>(undefined);

export function SavingsProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const savingsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'savings_transactions') : null, [firestore]);
  const { data: savingsData, isLoading } = useCollection<SavingsTransaction>(savingsQuery);
  const savingsTransactions = savingsData || [];

  const addSavingsTransaction = async (transaction: Omit<SavingsTransaction, 'id'>) => {
    if (!firestore) return;
    await addDoc(collection(firestore, 'savings_transactions'), transaction);
  };

  const deleteSavingsByDate = async (date: string) => {
    if (!firestore) return;
    const q = query(collection(firestore, 'savings_transactions'), where('date', '==', date));
    try {
      const snapshot = await getDocs(q);
      if(snapshot.empty) {
        toast({ title: "No data to delete." });
        return;
      }
      const batch = writeBatch(firestore);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: "Data Deleted", description: `Savings entries for ${date} have been removed.` });
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error deleting data", description: error.message });
    }
  };

  const deleteAllSavings = async () => {
    if (!firestore) return;
    const q = collection(firestore, 'savings_transactions');
    try {
      const snapshot = await getDocs(q);
      if(snapshot.empty) {
        toast({ title: "No data to delete." });
        return;
      }
      const batch = writeBatch(firestore);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: "All savings data deleted." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting all data", description: error.message });
    }
  };

  return (
    <SavingsContext.Provider value={{ savingsTransactions, isLoading, addSavingsTransaction, deleteSavingsByDate, deleteAllSavings }}>
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
