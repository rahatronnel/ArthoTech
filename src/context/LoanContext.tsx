"use client";

import { createContext, useState, useContext, ReactNode } from 'react';
import { 
    loanDisbursements as initialLoanDisbursements, 
    loanCollections as initialLoanCollections, 
    LoanDisbursement, 
    LoanCollection 
} from '@/lib/data';

type LoanContextType = {
  loanDisbursements: LoanDisbursement[];
  loanCollections: LoanCollection[];
  addLoanDisbursement: (disbursement: Omit<LoanDisbursement, 'id'>) => void;
  addLoanCollection: (collection: Omit<LoanCollection, 'id'>) => void;
};

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function LoanProvider({ children }: { children: ReactNode }) {
  const [loanDisbursements, setLoanDisbursements] = useState<LoanDisbursement[]>(initialLoanDisbursements);
  const [loanCollections, setLoanCollections] = useState<LoanCollection[]>(initialLoanCollections);

  const addLoanDisbursement = (disbursement: Omit<LoanDisbursement, 'id'>) => {
    const newDisbursement: LoanDisbursement = {
        id: `LD${loanDisbursements.length + 1}`,
        ...disbursement
    };
    setLoanDisbursements(prev => [...prev, newDisbursement]);
  };

  const addLoanCollection = (collection: Omit<LoanCollection, 'id'>) => {
    const newCollection: LoanCollection = {
        id: `LC${loanCollections.length + 1}`,
        ...collection
    };
    setLoanCollections(prev => [...prev, newCollection]);
  };

  return (
    <LoanContext.Provider value={{ loanDisbursements, loanCollections, addLoanDisbursement, addLoanCollection }}>
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
