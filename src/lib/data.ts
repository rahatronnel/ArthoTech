export type Region = {
  id: string;
  name: string;
  responsibleEmployeeId: string;
};

export type Zone = {
  id: string;
  name: string;
  region: string;
  responsibleEmployeeId: string;
};

export type Area = {
  id: string;
  name: string;
  zone: string;
  region: string;
  responsibleEmployeeId: string;
};

export type Branch = {
  id: string;
  name: string;
  area: string;
  zone: string;
  region: string;
};

export type Employee = {
  id: string;
  name: string;
  role: 'Branch User' | 'Area User' | 'Zonal User' | 'Regional User' | 'Head Office';
  assignment: string;
};

export type Group = {
  id: string;
  name: string;
  leader: string;
  members: number;
  totalLoans: number;
  totalSavings: number;
  status: 'Active' | 'Inactive';
};

export type Role = {
  name: string;
  description: string;
};

export const regions: Region[] = [
  { id: 'R001', name: 'Capital Region', responsibleEmployeeId: 'E004' },
  { id: 'R002', name: 'Western Region', responsibleEmployeeId: 'E004' },
  { id: 'R003', name: 'Southern Region', responsibleEmployeeId: 'E004' },
];

export const zones: Zone[] = [
  { id: 'Z001', name: 'Metro Zone', region: 'Capital Region', responsibleEmployeeId: 'E003'},
  { id: 'Z002', name: 'Suburban Zone', region: 'Capital Region', responsibleEmployeeId: 'E003'},
  { id: 'Z003', name: 'Coastal Zone', region: 'Southern Region', responsibleEmployeeId: 'E003'},
  { id: 'Z004', name: 'Western Zone', region: 'Western Region', responsibleEmployeeId: 'E003'},
];

export const areas: Area[] = [
  { id: 'A001', name: 'Central Area', zone: 'Metro Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A002', name: 'North Area', zone: 'Metro Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A003', name: 'West Area', zone: 'Suburban Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A004', name: 'East Area', zone: 'Western Zone', region: 'Western Region', responsibleEmployeeId: 'E002' },
  { id: 'A005', name: 'South Area', zone: 'Coastal Zone', region: 'Southern Region', responsibleEmployeeId: 'E002' },
];

export const branches: Branch[] = [
  { id: 'B001', name: 'Downtown Branch', area: 'Central Area', zone: 'Metro Zone', region: 'Capital Region' },
  { id: 'B002', name: 'Uptown Branch', area: 'North Area', zone: 'Metro Zone', region: 'Capital Region' },
  { id: 'B003', name: 'Westside Branch', area: 'West Area', zone: 'Suburban Zone', region: 'Capital Region' },
  { id: 'B004', name: 'Eastville Branch', area: 'East Area', zone: 'Western Zone', region: 'Western Region' },
  { id: 'B005', name: 'Southport Branch', area: 'South Area', zone: 'Coastal Zone', region: 'Southern Region' },
];

export const employees: Employee[] = [
  { id: 'E001', name: 'Alice Johnson', role: 'Branch User', assignment: 'Downtown Branch' },
  { id: 'E002', name: 'Bob Williams', role: 'Area User', assignment: 'Central Area' },
  { id: 'E003', name: 'Charlie Brown', role: 'Zonal User', assignment: 'Metro Zone' },
  { id: 'E004', name: 'Diana Prince', role: 'Regional User', assignment: 'Capital Region' },
  { id: 'E005', name: 'Ethan Hunt', role: 'Head Office', assignment: 'Head Office' },
  { id: 'E006', name: 'Fiona Glenanne', role: 'Branch User', assignment: 'Uptown Branch' },
];

export const groups: Group[] = [
  { id: 'G001', name: 'Sunrise Group', leader: 'Grace Lee', members: 12, totalLoans: 50000, totalSavings: 12000, status: 'Active' },
  { id: 'G002', name: 'Community Builders', leader: 'Henry Kim', members: 8, totalLoans: 32000, totalSavings: 8500, status: 'Active' },
  { id: 'G003', name: 'Future Stars', leader: 'Ivy Chen', members: 15, totalLoans: 75000, totalSavings: 20000, status: 'Active' },
  { id: 'G004', name: 'Old Timers', leader: 'Jack Davis', members: 5, totalLoans: 10000, totalSavings: 25000, status: 'Inactive' },
  { id: 'G005', name: 'Innovators Circle', leader: 'Karen White', members: 10, totalLoans: 60000, totalSavings: 15000, status: 'Active' },
];

export const roles: Role[] = [
    { name: 'Branch User', description: 'Manages operations within a single branch. Can create and manage groups, members, loans, and savings for their branch.' },
    { name: 'Area User', description: 'Oversees multiple branches within a specific area. Has read-only access to all data within their area and can generate reports.' },
    { name: 'Zonal User', description: 'Supervises several areas within a zone. Monitors performance and provides support to Area Users.' },
    { name: 'Regional User', description: 'Manages all zones within a region. Responsible for regional strategy, performance, and high-level reporting.' },
    { name: 'Head Office', description: 'Has full administrative access to the entire system. Manages system settings, user roles, and overall organization data.' },
];
