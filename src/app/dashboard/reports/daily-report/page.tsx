"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, ChevronLeft, Printer } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Region, Zone, Area, Branch, OtherDataEntry, Group, Employee } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useMember } from '@/context/MemberContext';
import { useSavings } from '@/context/SavingsContext';
import { useLoan } from '@/context/LoanContext';
import { useOthersData } from '@/context/OthersDataContext';
import { Skeleton } from '@/components/ui/skeleton';


type ReportLevel = 'region' | 'zone' | 'area' | 'branch';

type ReportRowData = {
  sl: number;
  branchName: string;
  areaName?: string;
  isSubtotal?: boolean;
  officerName?: string;
  officerCode?: string;
  memberAddToday: number;
  memberAddMonth: number;
  memberCancelToday: number;
  memberCancelMonth: number;
  savingsCollectionToday: number;
  savingsCollectionMonth: number;
  savingsRefundToday: number;
  savingsRefundMonth: number;
  loanDisburseToday: number;
  loanDisburseMonth: number;
  loanCollectionToday: number;
  loanCollectionMonth: number;
  otherExpense: number;
  cash: number;
  bank: number;
  afternoonCollection: number;
  riskFund: number;
  processingFee: number;
  passbookFee: number;
  admissionFee: number;
};

export default function DailyReportPage() {
  const [reportLevel, setReportLevel] = useState<ReportLevel>('branch');
  const [selectedId, setSelectedId] = useState<string>('all');
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [reportData, setReportData] = useState<ReportRowData[] | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [groupByOfficer, setGroupByOfficer] = useState(false);
  const [smokeTrigger, setSmokeTrigger] = useState(0);
  
  const firestore = useFirestore();
  const { currentUser, loading: userLoading } = useAuth();
  const { orgInfo } = useOrganization();

  const { memberChanges, isLoading: membersLoading } = useMember();
  const { savingsTransactions, isLoading: savingsLoading } = useSavings();
  const { loanDisbursements, loanCollections, isLoading: loansLoading } = useLoan();
  const { othersData, isLoading: othersLoading } = useOthersData();

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);
  
  const employeesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'employees') : null, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const isLoading = regionsLoading || zonesLoading || areasLoading || branchesLoading || userLoading || membersLoading || savingsLoading || loansLoading || othersLoading || groupsLoading || employeesLoading;

  const { availableLevels, availableRegions, availableZones, availableAreas, availableBranches } = useMemo(() => {
    if (!currentUser || isLoading) {
      return { availableLevels: [], availableRegions: [], availableZones: [], availableAreas: [], availableBranches: [] };
    }

    const { role, assignment } = currentUser;

    if (role === 'Super Admin' || role === 'Head Office') {
      return {
        availableLevels: ['region', 'zone', 'area', 'branch'],
        availableRegions: regions || [],
        availableZones: zones || [],
        availableAreas: areas || [],
        availableBranches: branches || [],
      };
    }

    let filteredLevels: ReportLevel[] = [];
    let filteredRegions: Region[] = [];
    let filteredZones: Zone[] = [];
    let filteredAreas: Area[] = [];
    let filteredBranches: Branch[] = [];

    switch (role) {
      case 'Regional User':
        filteredLevels = ['region', 'zone', 'area', 'branch'];
        const userRegion = regions?.find(r => r.id === assignment);
        if (userRegion) {
          filteredRegions = [userRegion];
          const regionZones = zones?.filter(z => z.regionId === userRegion.id) || [];
          filteredZones = regionZones;
          const zoneIds = new Set(regionZones.map(z => z.id));
          const regionAreas = areas?.filter(a => zoneIds.has(a.zoneId)) || [];
          filteredAreas = regionAreas;
          const areaIds = new Set(regionAreas.map(a => a.id));
          filteredBranches = branches?.filter(b => areaIds.has(b.areaId)) || [];
        }
        break;
      
      case 'Zonal User':
        filteredLevels = ['zone', 'area', 'branch'];
        const userZone = zones?.find(z => z.id === assignment);
        if (userZone) {
          filteredZones = [userZone];
          const zoneAreas = areas?.filter(a => a.zoneId === userZone.id) || [];
          filteredAreas = zoneAreas;
          const areaIds = new Set(zoneAreas.map(a => a.id));
          filteredBranches = branches?.filter(b => areaIds.has(b.areaId)) || [];
        }
        break;

      case 'Area User':
        filteredLevels = ['area', 'branch'];
        const userArea = areas?.find(a => a.id === assignment);
        if (userArea) {
          filteredAreas = [userArea];
          filteredBranches = branches?.filter(b => b.areaId === userArea.id) || [];
        }
        break;

      case 'Branch User':
        filteredLevels = ['branch'];
        const userBranch = branches?.find(b => b.id === assignment);
        if (userBranch) {
          filteredBranches = [userBranch];
        }
        break;
    }

    return {
      availableLevels: filteredLevels,
      availableRegions: filteredRegions,
      availableZones: filteredZones,
      availableAreas: filteredAreas,
      availableBranches: filteredBranches,
    };
  }, [currentUser, isLoading, regions, zones, areas, branches]);

  useEffect(() => {
    if (availableLevels.length > 0 && !availableLevels.includes(reportLevel)) {
      setReportLevel(availableLevels[0]);
      setSelectedId('all');
    }
  }, [availableLevels, reportLevel]);

  const reportTotals = useMemo(() => {
    if (!reportData) return null;
    return reportData.filter(row => !row.isSubtotal).reduce((acc, row) => {
        Object.keys(row).forEach(key => {
            if (key !== 'branchName' && key !== 'sl' && key !== 'officerName' && key !== 'officerCode' && key !== 'areaName' && key !== 'isSubtotal') {
                acc[key as keyof typeof acc] = (acc[key as keyof typeof acc] || 0) + (row[key as keyof ReportRowData] as number);
            }
        });
        return acc;
    }, {} as Omit<ReportRowData, 'sl' | 'branchName' | 'officerName' | 'officerCode' | 'areaName' | 'isSubtotal'>);
}, [reportData]);

  const handleGenerateReport = () => {
    setSmokeTrigger(key => key + 1);

    if (!date?.from || isLoading) {
      return;
    }
    
    const fromDate = date.from;
    const toDate = date.to || date.from;
    const reportInterval = { start: fromDate, end: toDate };
    const monthStart = startOfMonth(fromDate);
    const monthEnd = endOfMonth(fromDate);
    const monthInterval = { start: monthStart, end: monthEnd };

    let branchesToReportOn: Branch[] = [];
    let titleName = 'All';

    if (reportLevel === 'branch') {
        if (selectedId === 'all') { branchesToReportOn = availableBranches; titleName = 'All available branches'; } 
        else { const branch = availableBranches.find(b => b.id === selectedId); if (branch) { branchesToReportOn = [branch]; titleName = branch.name; } }
    } else if (reportLevel === 'area') {
        const areaIds = selectedId === 'all' ? new Set(availableAreas.map(a => a.id)) : new Set([selectedId]);
        branchesToReportOn = availableBranches.filter(b => areaIds.has(b.areaId));
        if (selectedId !== 'all') titleName = availableAreas.find(a => a.id === selectedId)?.name || '';
    } else if (reportLevel === 'zone') {
        const zoneIds = selectedId === 'all' ? new Set(availableZones.map(z => z.id)) : new Set([selectedId]);
        const areaIds = new Set(areas?.filter(a => zoneIds.has(a.zoneId)).map(a => a.id));
        branchesToReportOn = availableBranches.filter(b => areaIds.has(b.areaId));
        if (selectedId !== 'all') titleName = availableZones.find(z => z.id === selectedId)?.name || '';
    } else if (reportLevel === 'region') {
        const regionIds = selectedId === 'all' ? new Set(availableRegions.map(r => r.id)) : new Set([selectedId]);
        const zoneIds = new Set(zones?.filter(z => regionIds.has(z.regionId)).map(z => z.id));
        const areaIds = new Set(areas?.filter(a => zoneIds.has(a.zoneId)).map(a => a.id));
        branchesToReportOn = availableBranches.filter(b => areaIds.has(b.areaId));
        if (selectedId !== 'all') titleName = availableRegions.find(r => r.id === selectedId)?.name || '';
    }

    if (reportLevel === 'area' && !groupByOfficer) {
        setReportTitle(`Area-wise Report for: ${titleName}`);

        const areaMap = new Map<string, Branch[]>();
        branchesToReportOn.forEach(branch => {
            if (!areaMap.has(branch.areaId)) {
                areaMap.set(branch.areaId, []);
            }
            areaMap.get(branch.areaId)!.push(branch);
        });

        const finalReportData: ReportRowData[] = [];
        let sl = 1;
        
        const sortedAreaIds = Array.from(areaMap.keys()).sort((a,b) => (areas?.find(area => area.id === a)?.name || '').localeCompare(areas?.find(area => area.id === b)?.name || ''));

        for (const areaId of sortedAreaIds) {
            const areaBranches = areaMap.get(areaId)!;
            const areaName = areas?.find(a => a.id === areaId)?.name || 'Unknown Area';
            
            const areaSubtotal: ReportRowData = {
                sl: 0, isSubtotal: true, branchName: `Subtotal for ${areaName}`, areaName: areaName,
                memberAddToday: 0, memberAddMonth: 0, memberCancelToday: 0, memberCancelMonth: 0,
                savingsCollectionToday: 0, savingsCollectionMonth: 0, savingsRefundToday: 0, savingsRefundMonth: 0,
                loanDisburseToday: 0, loanDisburseMonth: 0, loanCollectionToday: 0, loanCollectionMonth: 0,
                otherExpense: 0, cash: 0, bank: 0, afternoonCollection: 0, riskFund: 0, processingFee: 0,
                passbookFee: 0, admissionFee: 0
            };

            areaBranches.forEach(branch => {
                const getSum = (data: any[], amountField: string, interval: {start:Date, end:Date}) => data.filter(item => item.branchId === branch.id && isWithinInterval(parseISO(item.date), interval)).reduce((sum, item) => sum + (item[amountField] || 0), 0);
                const getSumOthers = (data: OtherDataEntry[], type: OtherDataEntry['type'], interval: {start:Date, end:Date}) => data.filter(item => item.branchId === branch.id && item.type === type && isWithinInterval(parseISO(item.date), interval)).reduce((sum, item) => sum + (item.amount || 0), 0);

                const rowData: ReportRowData = {
                    sl: sl++,
                    branchName: `${branch.code} - ${branch.name}`,
                    areaName: areaName,
                    memberAddToday: getSum(memberChanges, 'added', reportInterval),
                    memberAddMonth: getSum(memberChanges, 'added', monthInterval),
                    memberCancelToday: getSum(memberChanges, 'dropped', reportInterval),
                    memberCancelMonth: getSum(memberChanges, 'dropped', monthInterval),
                    savingsCollectionToday: getSum(savingsTransactions, 'deposit', reportInterval),
                    savingsCollectionMonth: getSum(savingsTransactions, 'deposit', monthInterval),
                    savingsRefundToday: getSum(savingsTransactions, 'withdraw', reportInterval),
                    savingsRefundMonth: getSum(savingsTransactions, 'withdraw', monthInterval),
                    loanDisburseToday: getSum(loanDisbursements, 'amount', reportInterval),
                    loanDisburseMonth: getSum(loanDisbursements, 'amount', monthInterval),
                    loanCollectionToday: getSum(loanCollections, 'amount', reportInterval),
                    loanCollectionMonth: getSum(loanCollections, 'amount', monthInterval),
                    otherExpense: getSumOthers(othersData, 'Others Expenses', reportInterval),
                    cash: getSumOthers(othersData, 'Cash', reportInterval),
                    bank: getSumOthers(othersData, 'Bank', reportInterval),
                    afternoonCollection: getSumOthers(othersData, 'Afternoon Collection', reportInterval),
                    riskFund: getSumOthers(othersData, 'Risk Fund', reportInterval),
                    processingFee: getSumOthers(othersData, 'Processing Fee', reportInterval),
                    passbookFee: getSumOthers(othersData, 'Passbook Fee', reportInterval),
                    admissionFee: getSumOthers(othersData, 'Admission Fee', reportInterval),
                };

                finalReportData.push(rowData);
                
                Object.keys(areaSubtotal).forEach(key => {
                    if (typeof areaSubtotal[key as keyof ReportRowData] === 'number') {
                        (areaSubtotal[key as keyof ReportRowData] as number) += (rowData[key as keyof ReportRowData] as number);
                    }
                });
            });
            
            if (areaBranches.length > 0) {
              finalReportData.push(areaSubtotal);
            }
        }
        setReportData(finalReportData);

    } else if (groupByOfficer) {
        setReportTitle(`${reportLevel.charAt(0).toUpperCase() + reportLevel.slice(1)}-wise Report for: ${titleName} (Grouped by Field Officer)`);
        const employeeMap = new Map(employees?.map(e => [e.id, e]));
        const branchMap = new Map(branches?.map(b => [b.id, b]));
        const branchIdsToReportOn = new Set(branchesToReportOn.map(b => b.id));
        const groupsInScope = groupsData?.filter(g => branchIdsToReportOn.has(g.branchId) && g.responsibleEmployeeId) || [];
        const officerBranchTotals = new Map<string, Omit<ReportRowData, 'sl' | 'branchName' | 'officerName' | 'officerCode'>>();
        
        groupsInScope.forEach(group => {
            const officerId = group.responsibleEmployeeId;
            const branchId = group.branchId;
            const key = `${branchId}_${officerId}`;

            if (!officerBranchTotals.has(key)) {
                officerBranchTotals.set(key, {
                    memberAddToday: 0, memberAddMonth: 0,
                    memberCancelToday: 0, memberCancelMonth: 0,
                    savingsCollectionToday: 0, savingsCollectionMonth: 0,
                    savingsRefundToday: 0, savingsRefundMonth: 0,
                    loanDisburseToday: 0, loanDisburseMonth: 0,
                    loanCollectionToday: 0, loanCollectionMonth: 0,
                    otherExpense: 0, cash: 0, bank: 0, afternoonCollection: 0,
                    riskFund: 0, processingFee: 0, passbookFee: 0, admissionFee: 0,
                });
            }
            
            const totals = officerBranchTotals.get(key)!;
            const getSumForGroup = (data: any[], amountField: string, interval: {start:Date, end:Date}) => data.filter(item => item.groupId === group.id && isWithinInterval(parseISO(item.date), interval)).reduce((sum, item) => sum + (item[amountField] || 0), 0);

            totals.memberAddToday += getSumForGroup(memberChanges, 'added', reportInterval);
            totals.memberAddMonth += getSumForGroup(memberChanges, 'added', monthInterval);
            totals.memberCancelToday += getSumForGroup(memberChanges, 'dropped', reportInterval);
            totals.memberCancelMonth += getSumForGroup(memberChanges, 'dropped', monthInterval);
            totals.savingsCollectionToday += getSumForGroup(savingsTransactions, 'deposit', reportInterval);
            totals.savingsCollectionMonth += getSumForGroup(savingsTransactions, 'deposit', monthInterval);
            totals.savingsRefundToday += getSumForGroup(savingsTransactions, 'withdraw', reportInterval);
            totals.savingsRefundMonth += getSumForGroup(savingsTransactions, 'withdraw', monthInterval);
            totals.loanDisburseToday += getSumForGroup(loanDisbursements, 'amount', reportInterval);
            totals.loanDisburseMonth += getSumForGroup(loanDisbursements, 'amount', monthInterval);
            totals.loanCollectionToday += getSumForGroup(loanCollections, 'amount', reportInterval);
            totals.loanCollectionMonth += getSumForGroup(loanCollections, 'amount', monthInterval);
        });

        const processedData: ReportRowData[] = [];
        for (const [key, data] of officerBranchTotals.entries()) {
            const [branchId, officerId] = key.split('_');
            const branch = branchMap.get(branchId);
            const employee = employeeMap.get(officerId);

            if (branch && employee) {
                processedData.push({
                    sl: 0,
                    branchName: `${branch.code} - ${branch.name}`,
                    officerName: employee.name,
                    officerCode: employee.code,
                    ...data,
                });
            }
        }
        
        processedData.sort((a,b) => a.branchName.localeCompare(b.branchName) || (a.officerName || '').localeCompare(b.officerName || ''));
        processedData.forEach((row, i) => row.sl = i + 1);

        setReportData(processedData);

    } else {
        setReportTitle(`${reportLevel.charAt(0).toUpperCase() + reportLevel.slice(1)}-wise Report for: ${titleName}`);
        const processedData: ReportRowData[] = branchesToReportOn.map((branch, index) => {
            const getSum = (data: any[], amountField: string, interval: {start:Date, end:Date}) => data.filter(item => item.branchId === branch.id && isWithinInterval(parseISO(item.date), interval)).reduce((sum, item) => sum + (item[amountField] || 0), 0);
            const getSumOthers = (data: OtherDataEntry[], type: OtherDataEntry['type'], interval: {start:Date, end:Date}) => data.filter(item => item.branchId === branch.id && item.type === type && isWithinInterval(parseISO(item.date), interval)).reduce((sum, item) => sum + (item.amount || 0), 0);
            
            return {
                sl: index + 1,
                branchName: `${branch.code} - ${branch.name}`,
                memberAddToday: getSum(memberChanges, 'added', reportInterval),
                memberAddMonth: getSum(memberChanges, 'added', monthInterval),
                memberCancelToday: getSum(memberChanges, 'dropped', reportInterval),
                memberCancelMonth: getSum(memberChanges, 'dropped', monthInterval),
                savingsCollectionToday: getSum(savingsTransactions, 'deposit', reportInterval),
                savingsCollectionMonth: getSum(savingsTransactions, 'deposit', monthInterval),
                savingsRefundToday: getSum(savingsTransactions, 'withdraw', reportInterval),
                savingsRefundMonth: getSum(savingsTransactions, 'withdraw', monthInterval),
                loanDisburseToday: getSum(loanDisbursements, 'amount', reportInterval),
                loanDisburseMonth: getSum(loanDisbursements, 'amount', monthInterval),
                loanCollectionToday: getSum(loanCollections, 'amount', reportInterval),
                loanCollectionMonth: getSum(loanCollections, 'amount', monthInterval),
                otherExpense: getSumOthers(othersData, 'Others Expenses', reportInterval),
                cash: getSumOthers(othersData, 'Cash', reportInterval),
                bank: getSumOthers(othersData, 'Bank', reportInterval),
                afternoonCollection: getSumOthers(othersData, 'Afternoon Collection', reportInterval),
                riskFund: getSumOthers(othersData, 'Risk Fund', reportInterval),
                processingFee: getSumOthers(othersData, 'Processing Fee', reportInterval),
                passbookFee: getSumOthers(othersData, 'Passbook Fee', reportInterval),
                admissionFee: getSumOthers(othersData, 'Admission Fee', reportInterval),
            };
        });

        setReportData(processedData);
    }
  };
  
  const handlePrint = () => {
    window.print();
  };

  const renderDynamicFilter = () => {
    const dataMap: { [key in ReportLevel]: { data: any[], name: string } } = {
        region: { data: availableRegions, name: 'Region' },
        zone: { data: availableZones, name: 'Zone' },
        area: { data: availableAreas, name: 'Area' },
        branch: { data: availableBranches, name: 'Branch' },
    };

    const { data, name } = dataMap[reportLevel];
    const isLocked = data.length === 1 && currentUser?.role !== 'Super Admin' && currentUser?.role !== 'Head Office';

    useEffect(() => {
      if(isLocked && data[0] && selectedId !== data[0].id) {
        setSelectedId(data[0].id);
      }
    }, [isLocked, data, selectedId]);

    if (isLocked) {
        return (
            <div className="space-y-2">
                <Label>{name}</Label>
                <Input value={data[0]?.name || 'Loading...'} disabled />
            </div>
        );
    }
    
    return (
      <div className="space-y-2">
        <Label>{name}</Label>
        <Select
          value={selectedId}
          onValueChange={setSelectedId}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select a ${reportLevel}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`All available ${name}s`}</SelectItem>
            {data?.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN').format(amount);
  }
  
  const getFooterColSpan = () => {
    let span = 1; // For SL column
    if (reportLevel === 'area' && !groupByOfficer) span++; // For Area column
    if (groupByOfficer) span++; // For Officer column
    span++; // For Branch column
    return span;
  }

  return (
    <div className="space-y-6 print:p-8">
      {smokeTrigger > 0 && <div key={smokeTrigger} className="smoke-overlay" />}
       <div className="flex items-center gap-4 mb-6 print:hidden">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/reports">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Back to Reports</span>
                </Link>
            </Button>
            <h1 className="text-3xl font-bold">Daily Report</h1>
        </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select the criteria for your report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-2">
            <Label htmlFor="report-level">Report Level</Label>
            <Select 
              value={reportLevel} 
              onValueChange={(value) => { setReportLevel(value as ReportLevel); setSelectedId('all'); }}
              disabled={availableLevels.length <= 1}
            >
              <SelectTrigger id="report-level">
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent>
                {availableLevels.map(level => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}-wise
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {renderDynamicFilter()}

          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
             <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
          </div>

           <div className="space-y-2">
            <Label htmlFor="month-select">Or by Specific Month</Label>
             <Input
                type="month"
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                />
          </div>

           <div className="flex items-end gap-2">
             <Button onClick={handleGenerateReport} className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Generate Report'}
             </Button>
              <Button onClick={handlePrint} variant="outline" size="icon" disabled={!reportData}>
                <Printer className="h-4 w-4" />
                <span className="sr-only">Print</span>
             </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="group-by-officer" checked={groupByOfficer} onCheckedChange={(checked) => setGroupByOfficer(!!checked)} />
            <Label htmlFor="group-by-officer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Group by Field Officer
            </Label>
          </div>
        </CardContent>
      </Card>
      
      {isLoading && !reportData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>Your generated report will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {reportData && (
        <Card id="print-area">
          <CardHeader className="print:hidden">
              <CardTitle>Report Results</CardTitle>
              <CardDescription>{reportTitle}</CardDescription>
          </CardHeader>

          <div className="hidden print:block text-center mb-8">
            {orgInfo.logo && <Image src={orgInfo.logo} alt={orgInfo.name} width={120} height={50} className="mx-auto object-contain" />}
            <h1 className="text-2xl font-bold mt-2">{orgInfo.name}</h1>
            <p className="text-sm">{orgInfo.address}</p>
            <p className="text-sm font-semibold">MRA Certificate No: 195874</p>
            <h2 className="text-xl font-semibold mt-6 underline decoration-double">Daily Report</h2>
            <div className="text-sm text-muted-foreground mt-2">
                <p>
                  <span className="font-semibold">Search By:</span> {reportTitle}
                </p>
                <p>
                  <span className="font-semibold">Date:</span> {date?.from ? format(date.from, 'PPP') : 'N/A'}{date?.to && date.from !== date.to ? ` to ${format(date.to, 'PPP')}` : ''}
                </p>
                <p>
                  <span className="font-semibold">Print Date:</span> {format(new Date(), 'PPP')}
                </p>
            </div>
          </div>

          <CardContent className="overflow-x-auto">
               <Table>
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm shadow-lg">
                  <TableRow>
                    <TableHead rowSpan={2} className="align-bottom">SL</TableHead>
                    {(reportLevel === 'area' && !groupByOfficer) && <TableHead rowSpan={2} className="align-bottom border-r">Area</TableHead>}
                    <TableHead rowSpan={2} className="align-bottom border-r">Branch</TableHead>
                    {groupByOfficer && <TableHead rowSpan={2} className="align-bottom border-r">Field Officer</TableHead>}
                    <TableHead colSpan={2} className="text-center border-r">Member Add</TableHead>
                    <TableHead colSpan={2} className="text-center border-r">Member Cancel</TableHead>
                    <TableHead colSpan={2} className="text-center border-r">Savings Collection</TableHead>
                    <TableHead colSpan={2} className="text-center border-r">Savings Refund</TableHead>
                    <TableHead colSpan={2} className="text-center border-r">Loan Disburse</TableHead>
                    <TableHead colSpan={2} className="text-center border-r">Loan Collection</TableHead>
                    <TableHead rowSpan={2} className="align-bottom border-r">Other Expense</TableHead>
                    <TableHead rowSpan={2} className="align-bottom border-r">Cash</TableHead>
                    <TableHead rowSpan={2} className="align-bottom border-r">Bank</TableHead>
                    <TableHead colSpan={5} className="text-center">Others Collections</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center">Today</TableHead>
                    <TableHead className="text-center border-r">This Month</TableHead>
                    <TableHead className="text-center border-l">Afternoon Collection</TableHead>
                    <TableHead className="text-center border-l">Risk Fund</TableHead>
                    <TableHead className="text-center border-l">Processing Fee</TableHead>
                    <TableHead className="text-center border-l">Passbook Fee</TableHead>
                    <TableHead className="text-center border-l">Admission Fee</TableHead>
                  </TableRow>
                </thead>
                <TableBody>
                  {reportData.length > 0 ? reportData.map((row, index) => {
                    const isAreaGrouping = reportLevel === 'area' && !groupByOfficer;
                    
                    const showAreaCell = isAreaGrouping && !row.isSubtotal &&
                        (index === 0 || reportData[index - 1].areaName !== row.areaName || reportData[index-1].isSubtotal);

                    let areaRowCount = 1;
                    if (showAreaCell) {
                        for (let i = index + 1; i < reportData.length; i++) {
                            if (reportData[i].areaName === row.areaName && !reportData[i].isSubtotal) {
                                areaRowCount++;
                            } else {
                                break;
                            }
                        }
                    }

                    return (
                        <TableRow key={index} className={cn("transition-colors duration-300 hover:bg-accent", row.isSubtotal && "bg-secondary font-bold hover:bg-secondary/80")}>
                            {row.isSubtotal ? (
                                <TableCell colSpan={isAreaGrouping ? 2 : 1} className="text-right">{row.branchName}</TableCell>
                            ) : (
                                <>
                                    <TableCell>{row.sl}</TableCell>
                                    {showAreaCell && (
                                        <TableCell rowSpan={areaRowCount} className="font-medium border-r align-middle text-center">
                                            {row.areaName}
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium border-r">{row.branchName}</TableCell>
                                    {groupByOfficer && <TableCell className="font-medium border-r">{row.officerName} ({row.officerCode})</TableCell>}
                                </>
                            )}
                            <TableCell className="text-right">{formatCurrency(row.memberAddToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.memberAddMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.memberCancelToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.memberCancelMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.savingsCollectionToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.savingsCollectionMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.savingsRefundToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.savingsRefundMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.loanDisburseToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.loanDisburseMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.loanCollectionToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.loanCollectionMonth)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.otherExpense)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.cash)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(row.bank)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(row.afternoonCollection)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(row.riskFund)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(row.processingFee)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(row.passbookFee)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(row.admissionFee)}</TableCell>
                        </TableRow>
                    );
                  }) : (
                     <TableRow>
                        <TableCell colSpan={groupByOfficer ? 23 : (reportLevel === 'area' ? 23 : 22)} className="h-24 text-center text-muted-foreground">
                            No data found for the selected criteria.
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
                {reportTotals && (
                    <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.1),0_-2px_4px_-2px_rgb(0,0,0,0.1)]">
                        <TableRow className="font-bold hover:bg-transparent">
                            <TableCell colSpan={getFooterColSpan()} className="text-right">Grand Total</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.memberAddToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.memberAddMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.memberCancelToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.memberCancelMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.savingsCollectionToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.savingsCollectionMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.savingsRefundToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.savingsRefundMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.loanDisburseToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.loanDisburseMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportTotals.loanCollectionToday)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.loanCollectionMonth)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.otherExpense)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.cash)}</TableCell>
                            <TableCell className="text-right border-r">{formatCurrency(reportTotals.bank)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(reportTotals.afternoonCollection)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(reportTotals.riskFund)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(reportTotals.processingFee)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(reportTotals.passbookFee)}</TableCell>
                            <TableCell className="text-right border-l">{formatCurrency(reportTotals.admissionFee)}</TableCell>
                        </TableRow>
                    </tfoot>
                )}
              </Table>
          </CardContent>
        </Card>
      )}

      {!reportData && !isLoading && (
        <Card>
            <CardHeader>
                <CardTitle>Report Results</CardTitle>
                <CardDescription>Your generated report will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 text-muted-foreground">
                    <p>Please select your filters and click "Generate Report".</p>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
