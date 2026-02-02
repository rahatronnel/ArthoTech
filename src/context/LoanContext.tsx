"use client";

import { createContext, useContext, ReactNode } from 'react';
import { LoanDisbursement, LoanCollection } from '@/lib/data';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type LoanContextType = {
  loanDisbursements: LoanDisbursement[];
  loanCollections: LoanCollection[];
  isLoading: boolean;
  addLoanDisbursement: (disbursement: Omit<LoanDisbursement, 'id'>) => Promise<void>;
  addLoanCollection: (collection: Omit<LoanCollection, 'id'>) => Promise<void>;
  deleteDisbursementsByDate: (date: string) => Promise<void>;
  deleteAllDisbursements: () => Promise<void>;
  deleteCollectionsByDate: (date: string) => Promise<void>;
  deleteAllCollections: () => Promise<void>;
};

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function LoanProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const disbursementsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'loan_disbursements') : null, [firestore]);
  const { data: disbursementsData, isLoading: disbursementsLoading } = useCollection<LoanDisbursement>(disbursementsQuery);
  const loanDisbursements = disbursementsData || [];
  
  const collectionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'loan_collections') : null, [firestore]);
  const { data: collectionsData, isLoading: collectionsLoading } = useCollection<LoanCollection>(collectionsQuery);
  const loanCollections = collectionsData || [];

  const isLoading = disbursementsLoading || collectionsLoading;

  const addLoanDisbursement = async (disbursement: Omit<LoanDisbursement, 'id'>) => {
    if (!firestore) return;
    await addDoc(collection(firestore, 'loan_disbursements'), disbursement);
  };

  const addLoanCollection = async (collectionData: Omit<LoanCollection, 'id'>) => {
    if (!firestore) return;
    await addDoc(collection(firestore, 'loan_collections'), collectionData);
  };

  const deleteByDate = async (collectionName: string, date: string, title: string) => {
    if (!firestore) return;
    const q = query(collection(firestore, collectionName), where('date', '==', date));
    try {
      const snapshot = await getDocs(q);
      if(snapshot.empty) {
        toast({ title: `No ${title} to delete.` });
        return;
      }
      const batch = writeBatch(firestore);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: `Deleted ${title} for ${date}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: `Error deleting ${title}`, description: error.message });
    }
  };

  const deleteAll = async (collectionName: string, title: string) => {
     if (!firestore) return;
    const q = collection(firestore, collectionName);
    try {
      const snapshot = await getDocs(q);
      if(snapshot.empty) {
        toast({ title: `No ${title} to delete.` });
        return;
      }
      const batch = writeBatch(firestore);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: `All ${title} deleted` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: `Error deleting all ${title}`, description: error.message });
    }
  };


  return (
    <LoanContext.Provider value={{ 
      loanDisbursements, 
      loanCollections,
      isLoading, 
      addLoanDisbursement, 
      addLoanCollection, 
      deleteDisbursementsByDate: (date) => deleteByDate('loan_disbursements', date, 'disbursements'),
      deleteAllDisbursements: () => deleteAll('loan_disbursements', 'disbursements'),
      deleteCollectionsByDate: (date) => deleteByDate('loan_collections', date, 'collections'),
      deleteAllCollections: () => deleteAll('loan_collections', 'collections'),
    }}>
      {children}
    </LoanContext.Provider>
  );
}

export function useLoan() {
  const context = useContext(LoanContext);
  if (context === undefined) {
    throw new Error('useLoan must be used within a LoanProvider');
  }
  return context;
}
