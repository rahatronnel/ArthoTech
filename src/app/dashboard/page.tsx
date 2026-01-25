"use client"; // Needs to be a client component to use hooks

import { StatCard } from '@/components/dashboard/stat-card';
import { Building2, Users, UserRound, Banknote } from 'lucide-react';
import { branches, employees, groups as initialGroups } from '@/lib/data';
import { useSavings } from '@/context/SavingsContext'; 

export default function DashboardPage() {
  const { savingsTransactions } = useSavings();

  // Calculate total loans (as before)
  const totalLoans = initialGroups.reduce((sum, group) => sum + group.totalLoans, 0);

  // Calculate total current savings
  const totalInitialSavings = initialGroups.reduce((sum, group) => sum + group.initialSavings, 0);
  const totalDeposits = savingsTransactions.reduce((sum, t) => sum + t.deposit, 0);
  const totalWithdrawals = savingsTransactions.reduce((sum, t) => sum + t.withdraw, 0);
  const totalCurrentSavings = totalInitialSavings + totalDeposits - totalWithdrawals;

  return (
    <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-3xl font-bold">Welcome back, Admin!</h1>
            <p className="text-muted-foreground">Here's a summary of your organization's activities.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
            title="Total Branches"
            value={branches.length.toString()}
            icon={Building2}
            description="Number of active branches"
        />
        <StatCard
            title="Total Employees"
            value={employees.length.toString()}
            icon={Users}
            description="Number of staff members"
        />
        <StatCard
            title="Total Groups"
            value={initialGroups.length.toString()}
            icon={UserRound}
            description="Number of client groups"
        />
        <StatCard
            title="Total Savings"
            value={`$${(totalCurrentSavings / 1000).toFixed(1)}k`}
            icon={Banknote}
            description="Current total savings balance"
        />
        </div>
    </div>
  );
}
