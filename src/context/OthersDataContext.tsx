"use client";

import { createContext, useContext, ReactNode } from 'react';
import { OtherDataEntry } from '@/lib/data';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type OthersDataContextType = {
  othersData: OtherDataEntry[];
  isLoading: boolean;
  addBulkOthersData: (entries: Omit<OtherDataEntry, 'id'>[]) => Promise<void>;
  updateOthersData: (id: string, updatedEntry: Partial<Omit<OtherDataEntry, 'id'>>) => Promise<void>;
  deleteOthersData: (id: string) => Promise<void>;
  deleteOthersDataByDate: (date: string) => Promise<void>;
  deleteAllOthersData: () => Promise<void>;
};

const OthersDataContext = createContext<OthersDataContextType | undefined>(undefined);

export function OthersDataProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const othersDataQuery = useMemoFirebase(() => firestore ? collection(firestore, 'others_data') : null, [firestore]);
  const { data, isLoading } = useCollection<OtherDataEntry>(othersDataQuery);
  const othersData = data || [];

  const addBulkOthersData = async (entries: Omit<OtherDataEntry, 'id'>[]) => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    entries.forEach(entry => {
        const newDocRef = doc(collection(firestore, 'others_data'));
        batch.set(newDocRef, entry);
    });
    await batch.commit();
  };
  
  const updateOthersData = async (id: string, updatedEntry: Partial<Omit<OtherDataEntry, 'id' | 'type' | 'branch' | 'date'>>) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'others_data', id);
    await updateDoc(docRef, updatedEntry);
  };

  const deleteOthersData = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'others_data', id));
  };

  const deleteOthersDataByDate = async (date: string) => {
    if (!firestore) return;
    const q = query(collection(firestore, 'others_data'), where('date', '==', date));
    try {
        const snapshot = await getDocs(q);
        if(snapshot.empty) {
            toast({title: 'No data to delete.'});
            return;
        }
        const batch = writeBatch(firestore);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({title: 'Data deleted'});
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Error deleting data', description: e.message});
    }
  };

  const deleteAllOthersData = async () => {
    if (!firestore) return;
    const q = collection(firestore, 'others_data');
    try {
        const snapshot = await getDocs(q);
        if(snapshot.empty) {
            toast({title: 'No data to delete.'});
            return;
        }
        const batch = writeBatch(firestore);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({title: 'All data deleted'});
    } catch(e: any) {
        toast({variant: 'destructive', title: 'Error deleting data', description: e.message});
    }
  };

  return (
    <OthersDataContext.Provider value={{ othersData, isLoading, addBulkOthersData, updateOthersData, deleteOthersData, deleteOthersDataByDate, deleteAllOthersData }}>
      {children}
    </OthersDataContext.Provider>
  );
}

export function useOthersData() {
  const context = useContext(OthersDataContext);
  if (context === undefined) {
    throw new Error('useOthersData must be used within an OthersDataProvider');
  }
  return context;
}
