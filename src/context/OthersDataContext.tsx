"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import { OtherDataEntry } from '@/lib/data';
import { othersData as initialOthersData } from '@/lib/data';

type OthersDataContextType = {
  othersData: OtherDataEntry[];
  addBulkOthersData: (entries: Omit<OtherDataEntry, 'id'>[]) => void;
  updateOthersData: (id: string, updatedEntry: Partial<Omit<OtherDataEntry, 'id'>>) => void;
  deleteOthersData: (id: string) => void;
};

const OthersDataContext = createContext<OthersDataContextType | undefined>(undefined);

export function OthersDataProvider({ children }: { children: ReactNode }) {
  const [othersData, setOthersData] = useState<OtherDataEntry[]>(initialOthersData);

  const addBulkOthersData = (entries: Omit<OtherDataEntry, 'id'>[]) => {
    const newEntries = entries.map((entry, index) => ({
      id: `OD${othersData.length + Date.now() + index}`,
      ...entry
    }));
    setOthersData(prev => [...prev, ...newEntries]);
  };
  
  const updateOthersData = (id: string, updatedEntry: Partial<Omit<OtherDataEntry, 'id' | 'type' | 'branch' | 'date'>>) => {
    setOthersData(prev => prev.map(entry => entry.id === id ? { ...entry, ...updatedEntry } : entry));
  };

  const deleteOthersData = (id: string) => {
    setOthersData(prev => prev.filter(entry => entry.id !== id));
  };

  return (
    <OthersDataContext.Provider value={{ othersData, addBulkOthersData, updateOthersData, deleteOthersData }}>
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
