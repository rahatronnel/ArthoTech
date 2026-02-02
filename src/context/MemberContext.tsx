"use client";

import { createContext, useContext, ReactNode } from 'react';
import { GroupMemberChange } from '@/lib/data';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type MemberContextType = {
  memberChanges: GroupMemberChange[];
  isLoading: boolean;
  addMemberChange: (change: Omit<GroupMemberChange, 'id'>) => Promise<void>;
  deleteMemberChangesByDate: (date: string) => Promise<void>;
  deleteAllMemberChanges: () => Promise<void>;
};

const MemberContext = createContext<MemberContextType | undefined>(undefined);

export function MemberProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const memberChangesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'member_changes') : null, [firestore]);
  const { data: memberChangesData, isLoading } = useCollection<GroupMemberChange>(memberChangesQuery);
  const memberChanges = memberChangesData || [];

  const addMemberChange = async (change: Omit<GroupMemberChange, 'id'>) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Database not available' });
        return;
    }
    await addDoc(collection(firestore, 'member_changes'), change);
  };

  const deleteMemberChangesByDate = async (date: string) => {
    if (!firestore) return;
    const q = query(collection(firestore, 'member_changes'), where('date', '==', date));
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            toast({ title: 'No data to delete for this date.' });
            return;
        }
        const batch = writeBatch(firestore);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: 'Data Deleted', description: `All member changes for ${date} have been removed.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting data', description: error.message });
    }
  };

  const deleteAllMemberChanges = async () => {
    if (!firestore) return;
    const q = collection(firestore, 'member_changes');
     try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            toast({ title: 'No data to delete.' });
            return;
        }
        const batch = writeBatch(firestore);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: 'All member changes deleted.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting all data', description: error.message });
    }
  };

  return (
    <MemberContext.Provider value={{ memberChanges, isLoading, addMemberChange, deleteMemberChangesByDate, deleteAllMemberChanges }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  const context = useContext(MemberContext);
  if (context === undefined) {
    throw new Error('useMember must be used within a MemberProvider');
  }
  return context;
}
