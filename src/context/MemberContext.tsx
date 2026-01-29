"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import { GroupMemberChange } from '@/lib/data';

type MemberContextType = {
  memberChanges: GroupMemberChange[];
  addMemberChange: (change: Omit<GroupMemberChange, 'id'>) => void;
  deleteMemberChangesByDate: (date: string) => void;
  deleteAllMemberChanges: () => void;
};

const MemberContext = createContext<MemberContextType | undefined>(undefined);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [memberChanges, setMemberChanges] = useState<GroupMemberChange[]>([]);

  const addMemberChange = (change: Omit<GroupMemberChange, 'id'>) => {
    const newChange: GroupMemberChange = {
        id: `MC${memberChanges.length + 1}`,
        ...change
    };
    setMemberChanges(prev => [...prev, newChange]);
  };

  const deleteMemberChangesByDate = (date: string) => {
    setMemberChanges(prev => prev.filter(change => change.date !== date));
  };

  const deleteAllMemberChanges = () => {
    setMemberChanges([]);
  };

  return (
    <MemberContext.Provider value={{ memberChanges, addMemberChange, deleteMemberChangesByDate, deleteAllMemberChanges }}>
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
