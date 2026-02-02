
"use client";

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { useMember } from '@/context/MemberContext';
import { useSavings } from '@/context/SavingsContext';
import { useLoan } from '@/context/LoanContext';
import { useOthersData } from '@/context/OthersDataContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { collectionGroup, query, collection } from 'firebase/firestore';
import type { Group, Branch, Area, Zone, Region, GroupMemberChange, SavingsTransaction, LoanDisbursement, LoanCollection, OtherDataEntry } from '@/lib/data';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Printer, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';


interface ReportData {
  memberInfo: {
    opening: number;
    added: number;
    dropped: number;
    closing: number;
  };
  savingsInfo: {
    opening: number;
    deposit: number;
    withdraw: number;
    closing: number;
  };
  loanInfo: {
    opening: number;
    disbursement: number;
    collection: number;
    closing: number;
  };
  otherCollections: {
    admission: number;
    passbook: number;
    form: number;
    risk: number;
  };
}

export default function CrossCheckReportPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<string>('');

  const { orgInfo } = useOrganization();
  const firestore = useFirestore();
  const { currentUser, loading: userLoading } = useAuth();
  const { toast } = useToast();
  
  const { memberChanges, isLoading: membersLoading } = useMember();
  const { savingsTransactions, isLoading: savingsLoading } = useSavings();
  const { loanDisbursements, loanCollections, isLoading: loansLoading } = useLoan();
  const { othersData, isLoading: othersLoading } = useOthersData();

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);
  
  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areasData, isLoading: areasLoading } = useCollection<Area>(areasQuery);
  
  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zonesData, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regionsData, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);
  
  const { visibleBranchIds, branchesForFilter } = useMemo(() => {
    if (!currentUser || !branchesData || !areasData || !zonesData || !regionsData) {
      return { visibleBranchIds: new Set<string>(), branchesForFilter: [] };
    }

    const { role, assignment } = currentUser;

    if (role === 'Super Admin' || role === 'Head Office') {
      return { 
        visibleBranchIds: new Set(branchesData.map(b => b.id)), 
        branchesForFilter: branchesData 
      };
    }

    let ownedBranchIds = new Set<string>();
    let branchesToDisplay: Branch[] = [];

    if (role === 'Branch User') {
      const branch = branchesData.find(b => b.id === assignment);
      if (branch) {
        ownedBranchIds.add(branch.id);
        branchesToDisplay.push(branch);
      }
    } else if (role === 'Area User') {
      branchesToDisplay = branchesData.filter(b => b.areaId === assignment);
      ownedBranchIds = new Set(branchesToDisplay.map(b => b.id));
    } else if (role === 'Zonal User') {
      const childAreaIds = new Set(areasData.filter(a => a.zoneId === assignment).map(a => a.id));
      branchesToDisplay = branchesData.filter(b => childAreaIds.has(b.areaId));
      ownedBranchIds = new Set(branchesToDisplay.map(b => b.id));
    } else if (role === 'Regional User') {
      const childZoneIds = new Set(zonesData.filter(z => z.regionId === assignment).map(z => z.id));
      const childAreaIds = new Set(areasData.filter(a => childZoneIds.has(a.zoneId)).map(a => a.id));
      branchesToDisplay = branchesData.filter(b => childAreaIds.has(b.areaId));
      ownedBranchIds = new Set(branchesToDisplay.map(b => b.id));
    }

    return { visibleBranchIds: ownedBranchIds, branchesForFilter: branchesToDisplay };

  }, [currentUser, branchesData, areasData, zonesData, regionsData]);


  useEffect(() => {
    if (userLoading) return; // Wait until we know who the user is
    
    if (currentUser?.role === 'Branch User') {
      setFilterBranchId(currentUser.assignment || '');
    } else if (branchesForFilter.length > 0) {
      // For admins or managers, default to 'all'
      setFilterBranchId('all');
    }
  }, [currentUser, userLoading, branchesForFilter]);


  const handleGenerateReport = () => {
    if (!date) {
      toast({ variant: 'destructive', title: 'Date Required', description: 'Please select a date to generate the report.' });
      return;
    }
     if (!filterBranchId) {
      toast({ variant: 'destructive', title: 'Branch Required', description: 'Please select a branch to generate the report.' });
      return;
    }
    if (!groupsData || !branchesData) return;

    const selectedDateStr = date;
    const selectedDateObj = parseISO(selectedDateStr);

    const relevantBranchIds = filterBranchId === 'all' 
      ? visibleBranchIds 
      : new Set([filterBranchId]);

    const groupsForReport = groupsData.filter(g => relevantBranchIds.has(g.branchId));
    
    // Filter transactions based on relevant branch IDs
    const dailyMemberChanges = memberChanges.filter(c => c.date === selectedDateStr && relevantBranchIds.has(c.branchId));
    const pastMemberChanges = memberChanges.filter(c => isBefore(parseISO(c.date), selectedDateObj) && relevantBranchIds.has(c.branchId));

    const dailySavingsTx = savingsTransactions.filter(t => t.date === selectedDateStr && relevantBranchIds.has(t.branchId));
    const pastSavingsTx = savingsTransactions.filter(t => isBefore(parseISO(t.date), selectedDateObj) && relevantBranchIds.has(t.branchId));

    const dailyDisbursements = loanDisbursements.filter(d => d.date === selectedDateStr && relevantBranchIds.has(d.branchId));
    const pastDisbursements = loanDisbursements.filter(d => isBefore(parseISO(d.date), selectedDateObj) && relevantBranchIds.has(d.branchId));
    
    const dailyCollections = loanCollections.filter(c => c.date === selectedDateStr && relevantBranchIds.has(c.branchId));
    const pastCollections = loanCollections.filter(c => isBefore(parseISO(c.date), selectedDateObj) && relevantBranchIds.has(c.branchId));

    const dailyOthersData = othersData.filter(d => d.date === selectedDateStr && relevantBranchIds.has(d.branchId));

    // --- Member Calculation ---
    const initialMembers = groupsForReport.reduce((sum, g) => sum + g.initialMembers, 0);
    const openingMembers = initialMembers + pastMemberChanges.reduce((sum, c) => sum + c.added - c.dropped, 0);
    const addedToday = dailyMemberChanges.reduce((sum, c) => sum + c.added, 0);
    const droppedToday = dailyMemberChanges.reduce((sum, c) => sum + c.dropped, 0);

    // --- Savings Calculation ---
    const initialSavings = groupsForReport.reduce((sum, g) => sum + g.initialSavings, 0);
    const openingSavings = initialSavings + pastSavingsTx.reduce((sum, t) => sum + t.deposit - t.withdraw, 0);
    const depositedToday = dailySavingsTx.reduce((sum, t) => sum + t.deposit, 0);
    const withdrawnToday = dailySavingsTx.reduce((sum, t) => sum + t.withdraw, 0);

    // --- Loan Calculation ---
    const initialLoans = groupsForReport.reduce((sum, g) => sum + g.totalLoans, 0);
    const openingLoans = initialLoans 
        + pastDisbursements.reduce((sum, d) => sum + d.amount, 0)
        - pastCollections.reduce((sum, c) => sum + c.amount, 0);
    const disbursedToday = dailyDisbursements.reduce((sum, d) => sum + d.amount, 0);
    const collectedToday = dailyCollections.reduce((sum, c) => sum + c.amount, 0);

    // --- Other Collections ---
    const admissionFees = dailyOthersData.filter(d => d.type === 'Admission Fee').reduce((sum, d) => sum + d.amount, 0);
    const passbookFees = dailyOthersData.filter(d => d.type === 'Passbook Fee').reduce((sum, d) => sum + d.amount, 0);
    const formFees = dailyOthersData.filter(d => d.type === 'Processing Fee').reduce((sum, d) => sum + d.amount, 0);
    const riskFund = dailyOthersData.filter(d => d.type === 'Risk Fund').reduce((sum, d) => sum + d.amount, 0);
    
    setReportData({
      memberInfo: {
        opening: openingMembers,
        added: addedToday,
        dropped: droppedToday,
        closing: openingMembers + addedToday - droppedToday,
      },
      savingsInfo: {
        opening: openingSavings,
        deposit: depositedToday,
        withdraw: withdrawnToday,
        closing: openingSavings + depositedToday - withdrawnToday,
      },
      loanInfo: {
        opening: openingLoans,
        disbursement: disbursedToday,
        collection: collectedToday,
        closing: openingLoans + disbursedToday - collectedToday,
      },
      otherCollections: {
        admission: admissionFees,
        passbook: passbookFees,
        form: formFees,
        risk: riskFund,
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const isLoading = userLoading || groupsLoading || branchesLoading || areasLoading || zonesLoading || regionsLoading || membersLoading || savingsLoading || loansLoading || othersLoading;
  
  const reportTitleBranch = filterBranchId === 'all' 
    ? 'All Assigned Branches' 
    : branchesData?.find(b => b.id === filterBranchId)?.name || '';

  const renderBranchFilter = () => {
      if (isLoading) {
        return (
            <div className="grid gap-2">
                <Label>Branch</Label>
                <Skeleton className="h-10 w-[240px]" />
            </div>
        );
      }

      const isFilterDisabled = currentUser && currentUser.role !== 'Super Admin' && currentUser.role !== 'Head Office';
      const isSingleBranchUser = isFilterDisabled && branchesForFilter.length <= 1;

      if (isSingleBranchUser) {
        return (
          <div className="grid gap-2">
            <Label>Branch</Label>
            <Input
              value={branchesForFilter[0]?.name || 'No Branch Assigned'}
              disabled
              className="w-full sm:w-[240px]"
            />
          </div>
        );
      }

      // For Admins, HO, and Managers with multiple branches
      return (
        <div className="grid gap-2">
          <Label>Branch</Label>
          <Select
              value={filterBranchId}
              onValueChange={setFilterBranchId}
              disabled={isLoading}
          >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">All Assigned Branches</SelectItem>
                  {branchesForFilter?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
      );
    };

  return (
    <div className="print:p-8">
      <div className="flex items-center gap-4 mb-6 print:hidden">
         <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/reports">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back to Reports</span>
            </Link>
        </Button>
        <h1 className="text-3xl font-bold">Cross Check Report</h1>
      </div>

      <Card>
        <CardHeader className="print:hidden">
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>Select filters to generate the cross-check report.</CardDescription>
        </CardHeader>
        <CardContent className="print:hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid gap-2">
              <Label>Report Date</Label>
               <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full sm:w-[240px]"
              />
            </div>
            
            {renderBranchFilter()}

            <Button onClick={handleGenerateReport} disabled={isLoading || !date || !filterBranchId}>
                {isLoading ? "Loading..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && !reportData && (
          <Card className="mt-6">
              <CardContent className="p-6">
                  <Skeleton className="h-8 w-1/2 mb-4" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      )}

      {reportData && (
        <Card className="mt-6" id="print-area">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cross Check Report for {date ? format(parseISO(date), 'PPP') : ''}</CardTitle>
              <CardDescription>Displaying report for: <span className="font-semibold">{reportTitleBranch}</span></CardDescription>
            </div>
            <Button size="sm" className="gap-1 print:hidden" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Print Report
            </Button>
          </CardHeader>
          <CardContent>
             <div className="hidden print:block text-center mb-8">
                {orgInfo.logo && <Image src={orgInfo.logo} alt={orgInfo.name} width={120} height={50} className="mx-auto object-contain" />}
                <h1 className="text-2xl font-bold mt-2">{orgInfo.name}</h1>
                <p className="text-sm text-muted-foreground">{orgInfo.bengaliName}</p>
                <p className="text-xs text-muted-foreground">{orgInfo.address}</p>
                <h2 className="text-xl font-semibold mt-6 underline decoration-double">Cross Check Report for {date ? format(parseISO(date), 'PPP') : ''}</h2>
                <p className="text-md font-medium">Branch: {reportTitleBranch}</p>
            </div>
            <Table className="border">
              <TableHeader>
                <TableRow>
                    <TableHead colSpan={4} className="text-center font-bold bg-muted/50 border-r">Member Info</TableHead>
                    <TableHead colSpan={4} className="text-center font-bold bg-muted/50 border-r">Savings Info</TableHead>
                    <TableHead colSpan={4} className="text-center font-bold bg-muted/50 border-r">Loan Balance</TableHead>
                    <TableHead colSpan={4} className="text-center font-bold bg-muted/50">Other Collection</TableHead>
                </TableRow>
                <TableRow>
                    {/* Member */}
                    <TableHead className="border-r">Opening</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Dropped</TableHead>
                    <TableHead className="border-r">Closing</TableHead>
                    {/* Savings */}
                    <TableHead className="border-r">Opening</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Withdraw</TableHead>
                    <TableHead className="border-r">Closing</TableHead>
                    {/* Loan */}
                    <TableHead className="border-r">Opening</TableHead>
                    <TableHead>Disbursement</TableHead>
                    <TableHead>Collection</TableHead>
                    <TableHead className="border-r">Closing</TableHead>
                    {/* Other */}
                    <TableHead>Admission Fee</TableHead>
                    <TableHead>Passbook Fee</TableHead>
                    <TableHead>Form Fee</TableHead>
                    <TableHead>Risk Fund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                    {/* Member */}
                    <TableCell className="border-r font-medium">{reportData.memberInfo.opening}</TableCell>
                    <TableCell className="font-medium text-green-600">+{reportData.memberInfo.added}</TableCell>
                    <TableCell className="font-medium text-red-600">-{reportData.memberInfo.dropped}</TableCell>
                    <TableCell className="border-r font-bold">{reportData.memberInfo.closing}</TableCell>
                    {/* Savings */}
                    <TableCell className="border-r font-medium">{formatCurrency(reportData.savingsInfo.opening)}</TableCell>
                    <TableCell className="font-medium text-green-600">+{formatCurrency(reportData.savingsInfo.deposit)}</TableCell>
                    <TableCell className="font-medium text-red-600">-{formatCurrency(reportData.savingsInfo.withdraw)}</TableCell>
                    <TableCell className="border-r font-bold">{formatCurrency(reportData.savingsInfo.closing)}</TableCell>
                    {/* Loan */}
                    <TableCell className="border-r font-medium">{formatCurrency(reportData.loanInfo.opening)}</TableCell>
                    <TableCell className="font-medium text-blue-600">+{formatCurrency(reportData.loanInfo.disbursement)}</TableCell>
                    <TableCell className="font-medium text-green-600">-{formatCurrency(reportData.loanInfo.collection)}</TableCell>
                    <TableCell className="border-r font-bold">{formatCurrency(reportData.loanInfo.closing)}</TableCell>
                    {/* Other */}
                    <TableCell className="font-medium">{formatCurrency(reportData.otherCollections.admission)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.otherCollections.passbook)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.otherCollections.form)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(reportData.otherCollections.risk)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
