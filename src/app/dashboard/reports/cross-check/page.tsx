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
import type { Group, Branch } from '@/lib/data';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Printer, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';


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
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<string>('all');

  const { orgInfo } = useOrganization();
  const firestore = useFirestore();
  const { currentUser } = useAuth();

  const { memberChanges } = useMember();
  const { savingsTransactions } = useSavings();
  const { loanDisbursements, loanCollections } = useLoan();
  const { othersData } = useOthersData();

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const userBranch = useMemo(() => {
    if (!branchesData || !currentUser || currentUser.role !== 'Branch User') return null;
    return branchesData.find(b => b.name === currentUser.assignment);
  }, [branchesData, currentUser]);
  
  useEffect(() => {
    if (currentUser?.role === 'Branch User' && userBranch) {
      setFilterBranchId(userBranch.id);
    } else {
      setFilterBranchId('all');
    }
  }, [currentUser, userBranch]);

  const handleGenerateReport = () => {
    if (!date || !groupsData || !branchesData) return;

    const selectedDateStr = format(date, 'yyyy-MM-dd');
    const selectedDateObj = parseISO(selectedDateStr);

    // Filter groups based on selected branch
    const groupsForReport = filterBranchId === 'all'
      ? groupsData
      : groupsData.filter(g => g.branchId === filterBranchId);
    
    const visibleGroupIds = new Set(groupsForReport.map(g => g.id));

    // --- Member Calculation ---
    const initialMembers = groupsForReport.reduce((sum, g) => sum + g.initialMembers, 0);
    const prevMemberChanges = memberChanges.filter(c => visibleGroupIds.has(c.groupId) && isBefore(parseISO(c.date), selectedDateObj));
    const openingMembers = initialMembers + prevMemberChanges.reduce((sum, c) => sum + c.added - c.dropped, 0);
    const todayMemberChanges = memberChanges.filter(c => visibleGroupIds.has(c.groupId) && c.date === selectedDateStr);
    const addedToday = todayMemberChanges.reduce((sum, c) => sum + c.added, 0);
    const droppedToday = todayMemberChanges.reduce((sum, c) => sum + c.dropped, 0);

    // --- Savings Calculation ---
    const initialSavings = groupsForReport.reduce((sum, g) => sum + g.initialSavings, 0);
    const prevSavingsTx = savingsTransactions.filter(t => visibleGroupIds.has(t.groupId) && isBefore(parseISO(t.date), selectedDateObj));
    const openingSavings = initialSavings + prevSavingsTx.reduce((sum, t) => sum + t.deposit - t.withdraw, 0);
    const todaySavingsTx = savingsTransactions.filter(t => visibleGroupIds.has(t.groupId) && t.date === selectedDateStr);
    const depositedToday = todaySavingsTx.reduce((sum, t) => sum + t.deposit, 0);
    const withdrawnToday = todaySavingsTx.reduce((sum, t) => sum + t.withdraw, 0);

    // --- Loan Calculation ---
    const initialLoans = groupsForReport.reduce((sum, g) => sum + g.totalLoans, 0);
    const prevDisbursements = loanDisbursements.filter(d => visibleGroupIds.has(d.groupId) && isBefore(parseISO(d.date), selectedDateObj));
    const prevCollections = loanCollections.filter(c => visibleGroupIds.has(c.groupId) && isBefore(parseISO(c.date), selectedDateObj));
    const openingLoans = initialLoans 
        + prevDisbursements.reduce((sum, d) => sum + d.amount, 0)
        - prevCollections.reduce((sum, c) => sum + c.amount, 0);
    const disbursedToday = loanDisbursements.filter(d => visibleGroupIds.has(d.groupId) && d.date === selectedDateStr).reduce((sum, d) => sum + d.amount, 0);
    const collectedToday = loanCollections.filter(c => visibleGroupIds.has(c.groupId) && c.date === selectedDateStr).reduce((sum, c) => sum + c.amount, 0);

    // --- Other Collections ---
    const branchNameForFilter = branchesData.find(b => b.id === filterBranchId)?.name;
    const todayOthersData = filterBranchId === 'all'
      ? othersData.filter(d => d.date === selectedDateStr)
      : othersData.filter(d => d.date === selectedDateStr && d.branch === branchNameForFilter);
      
    const admissionFees = todayOthersData.filter(d => d.type === 'Admission Fee').reduce((sum, d) => sum + d.amount, 0);
    const passbookFees = todayOthersData.filter(d => d.type === 'Passbook Fee').reduce((sum, d) => sum + d.amount, 0);
    const formFees = todayOthersData.filter(d => d.type === 'Processing Fee').reduce((sum, d) => sum + d.amount, 0);
    const riskFund = todayOthersData.filter(d => d.type === 'Risk Fund').reduce((sum, d) => sum + d.amount, 0);
    
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
  
  const isLoading = groupsLoading || branchesLoading;
  const reportTitleBranch = filterBranchId === 'all' ? 'All Branches' : branchesData?.find(b => b.id === filterBranchId)?.name || '';

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
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {currentUser?.role === 'Branch User' ? (
                <div className="grid gap-2">
                    <Label>Branch</Label>
                    <Input 
                        value={userBranch?.name || ''} 
                        disabled 
                        className="w-[240px]"
                    />
                </div>
            ) : (
                <div className="grid gap-2">
                <Label>Branch</Label>
                <Select
                    value={filterBranchId}
                    onValueChange={setFilterBranchId}
                >
                    <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branchesData?.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>
            )}
            <Button onClick={handleGenerateReport} disabled={isLoading || !date}>
                {isLoading ? "Loading data..." : "Generate Report"}
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
              <CardTitle>Cross Check Report for {date ? format(date, 'PPP') : ''}</CardTitle>
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
                <h2 className="text-xl font-semibold mt-6 underline decoration-double">Cross Check Report for {date ? format(date, 'PPP') : ''}</h2>
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
                    <TableCell className="font-medium">{reportData.memberInfo.added}</TableCell>
                    <TableCell className="font-medium">{reportData.memberInfo.dropped}</TableCell>
                    <TableCell className="border-r font-bold">{reportData.memberInfo.closing}</TableCell>
                    {/* Savings */}
                    <TableCell className="border-r font-medium">{formatCurrency(reportData.savingsInfo.opening)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.savingsInfo.deposit)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.savingsInfo.withdraw)}</TableCell>
                    <TableCell className="border-r font-bold">{formatCurrency(reportData.savingsInfo.closing)}</TableCell>
                    {/* Loan */}
                    <TableCell className="border-r font-medium">{formatCurrency(reportData.loanInfo.opening)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.loanInfo.disbursement)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(reportData.loanInfo.collection)}</TableCell>
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
