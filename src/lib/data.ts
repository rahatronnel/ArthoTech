export type Region = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  responsibleEmployeeId: string;
};

export type Zone = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  region: string;
  responsibleEmployeeId: string;
};

export type Area = {
  id: string;
  name: string;
  code: string;
  bengaliName: string;
  zone: string;
  region: string;
  responsibleEmployeeId: string;
};

export type Branch = {
  id:string;
  name: string;
  code: string;
  bengaliName: string;
  area: string;
  zone: string;
  region: string;
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

export type MemberChangeEvent = {
  date: string;
  added: number;
  dropped: number;
  notes?: string;
};

export type Group = {
  id: string;
  name: string;
  leader: string;
  memberHistory: MemberChangeEvent[];
  totalLoans: number;
  totalSavings: number;
  status: 'Active' | 'Inactive';
  code: string;
  day: string;
};

export type Role = {
  name: string;
  description: string;
};

export const regions: Region[] = [
  { id: 'R001', name: 'Capital Region', code: 'CR', bengaliName: 'রাজধানী অঞ্চল', responsibleEmployeeId: 'E004' },
  { id: 'R002', name: 'Western Region', code: 'WR', bengaliName: 'পশ্চিম অঞ্চল', responsibleEmployeeId: 'E004' },
  { id: 'R003', name: 'Southern Region', code: 'SR', bengaliName: 'দক্ষিণ অঞ্চল', responsibleEmployeeId: 'E004' },
];

export const zones: Zone[] = [
  { id: 'Z001', name: 'Metro Zone', code: 'MZ', bengaliName: 'মেট্রো জোন', region: 'Capital Region', responsibleEmployeeId: 'E003'},
  { id: 'Z002', name: 'Suburban Zone', code: 'SZ', bengaliName: 'শহরতলী জোন', region: 'Capital Region', responsibleEmployeeId: 'E003'},
  { id: 'Z003', name: 'Coastal Zone', code: 'CZ', bengaliName: 'উপকূলীয় জোন', region: 'Southern Region', responsibleEmployeeId: 'E003'},
  { id: 'Z004', name: 'Western Zone', code: 'WZ', bengaliName: 'ওয়েস্টার্ন জোন', region: 'Western Region', responsibleEmployeeId: 'E003'},
];

export const areas: Area[] = [
  { id: 'A001', name: 'Central Area', code: 'CA', bengaliName: 'কেন্দ্রীয় এলাকা', zone: 'Metro Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A002', name: 'North Area', code: 'NA', bengaliName: 'উত্তর এলাকা', zone: 'Metro Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A003', name: 'West Area', code: 'WA', bengaliName: 'পশ্চিম এলাকা', zone: 'Suburban Zone', region: 'Capital Region', responsibleEmployeeId: 'E002' },
  { id: 'A004', name: 'East Area', code: 'EA', bengaliName: 'পূর্ব এলাকা', zone: 'Western Zone', region: 'Western Region', responsibleEmployeeId: 'E002' },
  { id: 'A005', name: 'South Area', code: 'SA', bengaliName: 'দক্ষিণ এলাকা', zone: 'Coastal Zone', region: 'Southern Region', responsibleEmployeeId: 'E002' },
];

export const branches: Branch[] = [
  { id: 'B001', name: 'Downtown Branch', code: 'DB', bengaliName: 'ডাউনটাউন শাখা', area: 'Central Area', zone: 'Metro Zone', region: 'Capital Region' },
  { id: 'B002', name: 'Uptown Branch', code: 'UB', bengaliName: 'আপটাউন শাখা', area: 'North Area', zone: 'Metro Zone', region: 'Capital Region' },
  { id: 'B003', name: 'Westside Branch', code: 'WB', bengaliName: 'ওয়েস্টসাইড শাখা', area: 'West Area', zone: 'Suburban Zone', region: 'Capital Region' },
  { id: 'B004', name: 'Eastville Branch', code: 'EB', bengaliName: 'ইস্টভিল শাখা', area: 'East Area', zone: 'Western Zone', region: 'Western Region' },
  { id: 'B005', name: 'Southport Branch', code: 'SB', bengaliName: 'সাউথপোর্ট শাখা', area: 'South Area', zone: 'Coastal Zone', region: 'Southern Region' },
];

export const employees: Employee[] = [
  { id: 'E000', code: 'USA001', name: 'Ultra Superadmin', bengaliName: 'আলট্রা সুপারঅ্যাডমিন', role: 'Super Admin', assignment: 'Head Office', loginId: 'superadmin', password: 'bangladesh' },
  { id: 'E001', code: 'E-001', name: 'Alice Johnson', bengaliName: 'অ্যালিস জনসন', role: 'Branch User', assignment: 'Downtown Branch', loginId: 'alice', password: 'password123' },
  { id: 'E002', code: 'E-002', name: 'Bob Williams', bengaliName: 'বব উইলিয়ামস', role: 'Area User', assignment: 'Central Area', loginId: 'bob', password: 'password123' },
  { id: 'E003', code: 'E-003', name: 'Charlie Brown', bengaliName: 'চার্লি ব্রাউন', role: 'Zonal User', assignment: 'Metro Zone', loginId: 'charlie', password: 'password123' },
  { id: 'E004', code: 'E-004', name: 'Diana Prince', bengaliName: 'ডায়ানা প্রিন্স', role: 'Regional User', assignment: 'Capital Region', loginId: 'diana', password: 'password123' },
  { id: 'E005', code: 'E-005', name: 'Ethan Hunt', bengaliName: 'এথান হান্ট', role: 'Head Office', assignment: 'Head Office', loginId: 'ethan', password: 'password123' },
  { id: 'E006', code: 'E-006', name: 'Fiona Glenanne', bengaliName: 'ফিওনা গ্লেনান', role: 'Branch User', assignment: 'Uptown Branch', loginId: 'fiona', password: 'password123' },
];

export const groups: Group[] = [
    { id: 'G001', name: 'Sunrise Group', code: 'SG001', day: 'Monday', leader: 'Grace Lee', memberHistory: [{ date: '2023-01-01', added: 12, dropped: 0, notes: 'Initial members' }], totalLoans: 50000, totalSavings: 12000, status: 'Active' },
    { id: 'G002', name: 'Community Builders', code: 'CB002', day: 'Tuesday', leader: 'Henry Kim', memberHistory: [{ date: '2023-01-01', added: 8, dropped: 0, notes: 'Initial members' }], totalLoans: 32000, totalSavings: 8500, status: 'Active' },
    { id: 'G003', name: 'Future Stars', code: 'FS003', day: 'Wednesday', leader: 'Ivy Chen', memberHistory: [{ date: '2023-01-01', added: 15, dropped: 0, notes: 'Initial members' }], totalLoans: 75000, totalSavings: 20000, status: 'Active' },
    { id: 'G004', name: 'Old Timers', code: 'OT004', day: 'Thursday', leader: 'Jack Davis', memberHistory: [{ date: '2023-01-01', added: 5, dropped: 0, notes: 'Initial members' }], totalLoans: 10000, totalSavings: 25000, status: 'Inactive' },
    { id: 'G005', name: 'Innovators Circle', code: 'IC005', day: 'Friday', leader: 'Karen White', memberHistory: [{ date: '2023-01-01', added: 10, dropped: 0, notes: 'Initial members' }], totalLoans: 60000, totalSavings: 15000, status: 'Active' },
];

export const roles: Role[] = [
    { name: 'Branch User', description: 'Manages operations within a single branch. Can create and manage groups, members, loans, and savings for their branch.' },
    { name: 'Area User', description: 'Oversees multiple branches within a specific area. Has read-only access to all data within their area and can generate reports.' },
    { name: 'Zonal User', description: 'Supervises several areas within a zone. Monitors performance and provides support to Area Users.' },
    { name: 'Regional User', description: 'Manages all zones within a region. Responsible for regional strategy, performance, and high-level reporting.' },
    { name: 'Head Office', description: 'Has full administrative access to the entire system. Manages system settings, user roles, and overall organization data.' },
];
