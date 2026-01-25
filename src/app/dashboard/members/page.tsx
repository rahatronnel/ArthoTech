"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMember } from '@/context/MemberContext';
import { groups } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isBefore, isEqual } from 'date-fns';

type ReportRow = {
  groupId: string;
  groupName: string;
  openingBalance: number;
  addedToday: number;
  droppedToday: number;
  closingBalance: number;
};

export default function MembersPage() {
  const { toast } = useToast();
  const { memberChanges, addMemberChange } = useMember();
  
  // State for the entry form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState('');
  const [added, setAdded] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [notes, setNotes] = useState('');

  // State for the report
  const [searchDate, setSearchDate] = useState('');
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);

  const handleAddChange = () => {
    if (!date || !groupId || (added === 0 && dropped === 0)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill out date, group, and at least one change (added/dropped).",
      });
      return;
    }
    addMemberChange({ date, groupId, added, dropped, notes });
    toast({
      title: "Change Recorded",
      description: `Member change for ${groups.find(g => g.id === groupId)?.name} on ${date} has been saved.`
    });
    // Reset form
    setGroupId('');
    setAdded(0);
    setDropped(0);
    setNotes('');
  };

  const handleSearch = () => {
    if (!searchDate) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please select a date to generate the report.",
        });
        return;
    }
    const targetDate = parseISO(searchDate);

    const report = groups.map(group => {
        const openingBalance = group.initialMembers + memberChanges
            .filter(c => c.groupId === group.id && isBefore(parseISO(c.date), targetDate))
            .reduce((acc, c) => acc + c.added - c.dropped, 0);

        const todaysChanges = memberChanges.filter(c => c.groupId === group.id && c.date === searchDate);
        
        const addedToday = todaysChanges.reduce((sum, c) => sum + c.added, 0);
        const droppedToday = todaysChanges.reduce((sum, c) => sum + c.dropped, 0);
        
        const closingBalance = openingBalance + addedToday - droppedToday;

        return {
            groupId: group.id,
            groupName: group.name,
            openingBalance,
            addedToday,
            droppedToday,
            closingBalance,
        };
    });
    setReportData(report);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Member Management</h1>
        <p className="text-muted-foreground">Record member changes and view daily balance reports.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Add Member Change</CardTitle>
            <CardDescription>Record the number of members added or dropped for a group on a specific date.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-date">Date</Label>
              <Input id="change-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select onValueChange={setGroupId} value={groupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="added">Members Added</Label>
                <Input id="added" type="number" min="0" value={added} onChange={(e) => setAdded(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropped">Members Dropped</Label>
                <Input id="dropped" type="number" min="0" value={dropped} onChange={(e) => setDropped(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."/>
            </div>
            <Button onClick={handleAddChange} className="w-full">Save Change</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Member Balance Report</CardTitle>
            <CardDescription>Select a date to see the member balance for each group.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2 flex-grow">
                <Label htmlFor="search-date">Report Date</Label>
                <Input id="search-date" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
              </div>
              <Button onClick={handleSearch} className="w-full sm:w-auto">Search</Button>
            </div>
            
            <div className="mt-6">
                {reportData ? (
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Group</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Added</TableHead>
                                <TableHead className="text-right">Dropped</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map(row => (
                                <TableRow key={row.groupId}>
                                    <TableCell className="font-medium">{row.groupName}</TableCell>
                                    <TableCell className="text-right">{row.openingBalance}</TableCell>
                                    <TableCell className="text-right text-green-600">+{row.addedToday}</TableCell>
                                    <TableCell className="text-right text-red-600">-{row.droppedToday}</TableCell>
                                    <TableCell className="text-right font-bold">{row.closingBalance}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>Please select a date and click "Search" to view the report.</p>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
