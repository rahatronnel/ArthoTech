"use client";

import { useMemo } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { Building2, Users, UserRound, Banknote, Landmark } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Branch, Employee, Group } from '@/lib/data';
import { useSavings } from '@/context/SavingsContext';
import { useLoan } from '@/context/LoanContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Organogram } from '@/components/dashboard/organogram';
import { EmployeeDiagram } from '@/components/dashboard/employee-diagram';

function StatSkeleton() {
  return (
    <div className="p-4 border rounded-lg shadow-sm">
        <div className="flex flex-row items-center justify-between pb-2 space-y-0">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="w-4 h-4" />
        </div>
        <div>
            <Skeleton className="w-1/2 h-7" />
            <Skeleton className="w-3/4 h-3 mt-1" />
        </div>
    </div>
  );
}

export default function DashboardPage() {
  const firestore = useFirestore();

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const employeesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'employees')) : null, [firestore]);
  const { data: employeesData, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const { savingsTransactions, isLoading: savingsLoading } = useSavings();
  const { loanCollections, loanDisbursements, isLoading: loansLoading } = useLoan();
  
  const isLoading = branchesLoading || employeesLoading || groupsLoading || savingsLoading || loansLoading;
  
  const totalCurrentSavings = useMemo(() => {
    if (!groupsData || !savingsTransactions) return 0;
    const initial = groupsData.reduce((sum, group) => sum + (group.initialSavings || 0), 0);
    const deposits = savingsTransactions.reduce((sum, t) => sum + t.deposit, 0);
    const withdrawals = savingsTransactions.reduce((sum, t) => sum + t.withdraw, 0);
    return initial + deposits - withdrawals;
  }, [groupsData, savingsTransactions]);

  const totalOutstandingLoan = useMemo(() => {
    if(!groupsData || !loanDisbursements || !loanCollections) return 0;
    const initial = groupsData.reduce((sum, group) => sum + (group.totalLoans || 0), 0);
    const disbursed = loanDisbursements.reduce((sum, d) => sum + d.amount, 0);
    const collected = loanCollections.reduce((sum, c) => sum + c.amount, 0);
    return initial + disbursed - collected;
  }, [groupsData, loanDisbursements, loanCollections]);


  if (isLoading) {
      return (
          <div className="flex flex-col gap-6">
              <div>
                  <h1 className="text-3xl font-bold">Welcome back!</h1>
                  <p className="text-muted-foreground">Here's a summary of your organization's activities.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
              </div>
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-96 w-full mt-6" />
          </div>
      )
  }

  return (
    <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-3xl font-bold">Welcome back!</h1>
            <p className="text-muted-foreground">Here's a summary of your organization's activities.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
            title="Total Branches"
            value={branchesData?.length.toString() || '0'}
            icon={Building2}
            description="Number of active branches"
        />
        <StatCard
            title="Total Employees"
            value={employeesData?.length.toString() || '0'}
            icon={Users}
            description="Number of staff members"
        />
        <StatCard
            title="Total Groups"
            value={groupsData?.length.toString() || '0'}
            icon={UserRound}
            description="Number of client groups"
        />
        <StatCard
            title="Total Savings"
            value={`$${(totalCurrentSavings / 1000).toFixed(1)}k`}
            icon={Banknote}
            description="Current total savings balance"
        />
         <StatCard
            title="Outstanding Loan"
            value={`$${(totalOutstandingLoan / 1000).toFixed(1)}k`}
            icon={Landmark}
            description="Current outstanding loan balance"
        />
        </div>
        
        <Organogram />
        <EmployeeDiagram />
    </div>
  );
}
