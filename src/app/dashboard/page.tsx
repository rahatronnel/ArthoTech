"use client";

import { StatCard } from '@/components/dashboard/stat-card';
import { Building2, Users, UserRound, Banknote, Landmark } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Branch, Employee, Group, Savings, Loan } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';

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

  const savingsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'savings')) : null, [firestore]);
  const { data: savingsData, isLoading: savingsLoading } = useCollection<Savings>(savingsQuery);

  const loansQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'loans')) : null, [firestore]);
  const { data: loansData, isLoading: loansLoading } = useCollection<Loan>(loansQuery);

  const isLoading = branchesLoading || employeesLoading || groupsLoading || savingsLoading || loansLoading;

  // WARNING: The calculations below are based on a simplified data model and may not be accurate.
  // The 'Loan' and 'Savings' collections currently only track disbursements and deposits.
  // Collections and withdrawals are not yet implemented in Firestore.
  const totalInitialSavings = groupsData?.reduce((sum, group) => sum + (group.initialSavings || 0), 0) || 0;
  const totalDeposits = savingsData?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalWithdrawals = 0; // Not implemented yet
  const totalCurrentSavings = totalInitialSavings + totalDeposits - totalWithdrawals;

  const totalInitialLoans = groupsData?.reduce((sum, group) => sum + (group.totalLoans || 0), 0) || 0;
  const totalDisbursed = loansData?.reduce((sum, d) => sum + d.amount, 0) || 0;
  const totalCollected = 0; // Not implemented yet
  const totalOutstandingLoan = totalInitialLoans + totalDisbursed - totalCollected;

  if (isLoading) {
      return (
          <div className="flex flex-col gap-6">
              <div>
                  <h1 className="text-3xl font-bold">Welcome back, Admin!</h1>
                  <p className="text-muted-foreground">Here's a summary of your organization's activities.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-3xl font-bold">Welcome back, Admin!</h1>
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
    </div>
  );
}
