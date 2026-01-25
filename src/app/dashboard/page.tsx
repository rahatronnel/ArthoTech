import { StatCard } from '@/components/dashboard/stat-card';
import { Building2, Users, UserRound, Banknote } from 'lucide-react';
import { branches, employees, groups } from '@/lib/data';

export default function DashboardPage() {
  const totalLoans = groups.reduce((sum, group) => sum + group.totalLoans, 0);

  return (
    <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-3xl font-bold">Welcome back, Admin!</h1>
            <p className="text-muted-foreground">Here's a summary of your organization's activities.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            value={groups.length.toString()}
            icon={UserRound}
            description="Number of client groups"
        />
        <StatCard
            title="Total Loans Disbursed"
            value={`$${(totalLoans / 1000).toFixed(1)}k`}
            icon={Banknote}
            description="Total loan amount across all groups"
        />
        </div>
    </div>
  );
}
