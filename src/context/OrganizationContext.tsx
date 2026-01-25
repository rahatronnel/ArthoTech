"use client";

import { createContext, useState, useContext, ReactNode } from 'react';

export type OrganizationInfo = {
  name: string;
  bengaliName: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  designation: string;
  logo: string | null;
  favicon: string | null;
};

type OrganizationContextType = {
  orgInfo: OrganizationInfo;
  setOrgInfo: (info: OrganizationInfo) => void;
};

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo>({
    name: 'ArthoTech',
    bengaliName: 'অর্থটেক',
    address: '',
    phone: '',
    email: '',
    contactPerson: '',
    designation: '',
    logo: null,
    favicon: null,
  });

  return (
    <OrganizationContext.Provider value={{ orgInfo, setOrgInfo }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
