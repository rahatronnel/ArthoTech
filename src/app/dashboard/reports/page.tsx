import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

const reports = [
  {
    title: 'Branch Wise Basic Report',
    description: 'A basic report showing details for each branch.',
    href: '/dashboard/reports/branch-wise',
  },
  {
    title: 'Cross Check Report',
    description: 'A daily summary of all financial and member activities.',
    href: '/dashboard/reports/cross-check',
  },
];

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Select a report to view.</p>
      </div>
      <div className="grid gap-6">
        {reports.map((report) => (
          <Link href={report.href} key={report.title} className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
