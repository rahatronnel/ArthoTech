"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { useAuth } from '@/context/AuthContext';

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
  const { currentUser, loading: userLoading } = useAuth();

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const isLoading = regionsLoading || zonesLoading || areasLoading || branchesLoading || userLoading;

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
      availableLevels,
      availableRegions,
      availableZones,
      availableAreas,
      availableBranches,
    };
  }, [currentUser, isLoading, regions, zones, areas, branches]);

  useEffect(() => {
    if (availableLevels.length > 0 && !availableLevels.includes(reportLevel)) {
      setReportLevel(availableLevels[0]);
      setSelectedId('all');
    }
  }, [availableLevels, reportLevel]);

  const handleGenerateReport = () => {
    console.log({ reportLevel, selectedId, date, selectedMonth });
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