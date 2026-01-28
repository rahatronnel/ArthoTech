export type Region = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  responsibleEmployeeId?: string;
};

export type Zone = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  regionId: string;
  responsibleEmployeeId?: string;
};

export type Area = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  zoneId: string;
  responsibleEmployeeId?: string;
};

export type Branch = {
  id:string;
  name: string;
  code: string;
  bengaliName: string;
  areaId: string;
  address: string;
  contactNumber: string;
};

export type Employee = {
  id: string;
  code: string;
  name: string;
  bengaliName: string;
  role: 'Branch User' | 'Area User' | 'Zonal User' | 'Regional User' | 'Head Office' | 'Super Admin';
  assignment: string;
  loginId: string;
  password?: string;
};

export type GroupMemberChange = {
  id: string;
  date: string;
  groupId: string;
  added: number;
  dropped: number;
  notes?: string;
};

export type SavingsTransaction = {
  id: string;
  date: string;
  groupId: string;
  deposit: number;
  withdraw: number;
  notes?: string;
};

export type LoanDisbursement = {
  id: string;
  date: string;
  groupId: string;
  amount: number;
  notes?: string;
};

export type LoanCollection = {
  id: string;
  date: string;
  groupId: string;
  amount: number;
  notes?: string;
};

export type OtherDataEntry = {
  id: string;
  date: string;
  branch: string;
  type: 'Others Expenses' | 'Cash' | 'Bank' | 'Afternoon Collection' | 'Today Total Cash' | 'Risk Fund' | 'Processing Fee' | 'Passbook Fee' | 'Admission Fee';
  amount: number;
  notes?: string;
};

export const otherDataTypes: Readonly<OtherDataEntry['type'][]> = ['Others Expenses', 'Cash', 'Bank', 'Afternoon Collection', 'Today Total Cash', 'Risk Fund', 'Processing Fee', 'Passbook Fee', 'Admission Fee'];

export type Group = {
  id: string;
  name: string;
  responsibleEmployeeId: string;
  initialMembers: number;
  totalLoans: number;
  initialSavings: number;
  status: 'Active' | 'Inactive';
  code: string;
  day: string;
  branchId: string;
};

export type Role = {
  name: string;
  description: string;
};

// Mock data is no longer needed as all data will come from Firestore.
// The types above will be used with Firestore data.

export const roles: Role[] = [
    { name: 'Branch User', description: 'Manages operations within a single branch. Can create and manage groups, members, loans, and savings for their branch.' },
    { name: 'Area User', description: 'Oversees multiple branches within a specific area. Has read-only access to all data within their area and can generate reports.' },
    { name: 'Zonal User', description: 'Supervises several areas within a zone. Monitors performance and provides support to Area Users.' },
    { name: 'Regional User', description: 'Manages all zones within a region. Responsible for regional strategy, performance, and high-level reporting.' },
    { name: 'Head Office', description: 'Has full administrative access to the entire system. Manages system settings, user roles, and overall organization data.' },
    { name: 'Super Admin', description: 'Has complete control over the application, including deleting all data.' },
];
