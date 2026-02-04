
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, ChevronLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Region, Zone, Area, Branch } from '@/lib/data';

type ReportLevel = 'region' | 'zone' | 'area' | 'branch';

export default function DailyReportPage() {
  const [reportLevel, setReportLevel] = useState<ReportLevel>('branch');
  const [selectedId, setSelectedId] = useState<string>('all');
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  const firestore = useFirestore();

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const isLoading = regionsLoading || zonesLoading || areasLoading || branchesLoading;

  const handleGenerateReport = () => {
    // Logic to generate report will be added later
    console.log({ reportLevel, selectedId, date, selectedMonth });
  };
  
  const renderDynamicFilter = () => {
    const commonProps = {
      value: selectedId,
      onValueChange: setSelectedId,
      disabled: isLoading,
    };

    const triggerPlaceholder = `Select a ${reportLevel}`;
    const allOptionLabel = `All ${reportLevel}s`;

    switch (reportLevel) {
      case 'region':
        return (
          <div className="space-y-2">
            <Label>Region</Label>
            <Select {...commonProps}>
              <SelectTrigger><SelectValue placeholder={triggerPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allOptionLabel}</SelectItem>
                {regions?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case 'zone':
        return (
          <div className="space-y-2">
            <Label>Zone</Label>
            <Select {...commonProps}>
              <SelectTrigger><SelectValue placeholder={triggerPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allOptionLabel}</SelectItem>
                {zones?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case 'area':
        return (
          <div className="space-y-2">
            <Label>Area</Label>
            <Select {...commonProps}>
              <SelectTrigger><SelectValue placeholder={triggerPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allOptionLabel}</SelectItem>
                {areas?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case 'branch':
        return (
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select {...commonProps}>
              <SelectTrigger><SelectValue placeholder={triggerPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allOptionLabel}</SelectItem>
                {branches?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4 mb-6 print:hidden">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/reports">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Back to Reports</span>
                </Link>
            </Button>
            <h1 className="text-3xl font-bold">Daily Report</h1>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select the criteria for your report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="report-level">Report Level</Label>
            <Select value={reportLevel} onValueChange={(value) => { setReportLevel(value as ReportLevel); setSelectedId('all'); }}>
              <SelectTrigger id="report-level">
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="region">Region-wise</SelectItem>
                <SelectItem value="zone">Zone-wise</SelectItem>
                <SelectItem value="area">Area-wise</SelectItem>
                <SelectItem value="branch">Branch-wise</SelectItem>
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

           <div className="flex items-end">
             <Button onClick={handleGenerateReport} className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Generate Report'}
             </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>Your generated report will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-10 text-muted-foreground">
                <p>Please select your filters and click "Generate Report".</p>
                <p className="text-sm">The report columns will be defined next.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

