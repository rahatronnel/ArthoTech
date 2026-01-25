"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMember } from '@/context/MemberContext';
import { groups } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isBefore } from 'date-fns';
import { Upload, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type ReportRow = {
  groupId: string;
  groupName: string;
  openingBalance: number;
  addedToday: number;
  droppedToday: number;
  closingBalance: number;
};

type UploadedRow = {
  GroupID: string;
  GroupName: string;
  MembersAdded: number;
  MembersDropped: number;
  Notes: string;
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

  // State for bulk upload
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleDownloadTemplate = () => {
    const templateData = groups.map(g => ({
        GroupID: g.id,
        GroupName: g.name,
        MembersAdded: 0,
        MembersDropped: 0,
        Notes: ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
    XLSX.writeFile(workbook, "MemberChangesTemplate.xlsx");
    toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
  };

  const handleProcessUpload = () => {
    if (!file) {
      toast({ variant: "destructive", title: "No file selected", description: "Please select a file to upload." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const validData: UploadedRow[] = jsonData.filter(row => row.GroupID && (Number(row.MembersAdded) > 0 || Number(row.MembersDropped) > 0)).map(row => ({
            GroupID: String(row.GroupID),
            GroupName: String(row.GroupName || groups.find(g => g.id === String(row.GroupID))?.name || 'Unknown'),
            MembersAdded: Number(row.MembersAdded) || 0,
            MembersDropped: Number(row.MembersDropped) || 0,
            Notes: String(row.Notes || ''),
        }));

        if (validData.length === 0) {
            toast({ variant: "destructive", title: "Invalid File", description: "The uploaded file contains no valid data to process." });
            return;
        }

        setUploadedData(validData);
        setIsConfirmDialogOpen(true);

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ variant: "destructive", title: "Error reading file", description: "There was a problem processing the Excel file." });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = () => {
    if (!uploadDate) {
        toast({ variant: "destructive", title: "Date required", description: "Please select a date for the bulk upload." });
        return;
    }
    let changesCount = 0;
    uploadedData.forEach(row => {
        if (row.MembersAdded > 0 || row.MembersDropped > 0) {
            addMemberChange({
                date: uploadDate,
                groupId: row.GroupID,
                added: row.MembersAdded,
                dropped: row.MembersDropped,
                notes: `Bulk upload: ${row.Notes || ''}`.trim(),
            });
            changesCount++;
        }
    });

    toast({ title: "Bulk Upload Successful", description: `${changesCount} member changes have been recorded for ${uploadDate}.` });
    
    // Reset state
    setIsConfirmDialogOpen(false);
    setUploadedData([]);
    setFile(null);
    const fileInput = document.getElementById('bulk-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Member Changes</CardTitle>
            <CardDescription>Download the template, fill it out, and upload it here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Template
            </Button>
            <div className="space-y-2">
              <Label htmlFor="bulk-upload">Upload Filled Template</Label>
              <Input id="bulk-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">
                File must be the downloaded template with your data filled in.
              </p>
            </div>
            <Button onClick={handleProcessUpload} className="w-full" disabled={!file}>
              <Upload className="mr-2 h-4 w-4" />
              Upload and Preview
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
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

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Upload</DialogTitle>
            <DialogDescription>
              Review the member changes below. Select a date for these changes and click "Confirm" to save.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="space-y-2">
              <Label htmlFor="upload-date">Date for Changes</Label>
              <Input id="upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
            </div>
            <ScrollArea className="h-64">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Group Name</TableHead>
                            <TableHead className="text-right">Members Added</TableHead>
                            <TableHead className="text-right">Members Dropped</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {uploadedData.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell>{row.GroupName}</TableCell>
                                <TableCell className="text-right">{row.MembersAdded}</TableCell>
                                <TableCell className="text-right">{row.MembersDropped}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmUpload}>Confirm & Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
