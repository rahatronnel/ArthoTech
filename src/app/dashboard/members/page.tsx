
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { parseISO, isBefore } from 'date-fns';
import { Upload, Download, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import type { Group, Branch } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

const formatGroupCode = (rawCode: string | number): string => {
    const codeStr = String(rawCode).trim();
    if (!codeStr.includes('.')) return codeStr; 

    const parts = codeStr.split('.');
    if (parts.length !== 2) return codeStr;

    const beforeDot = parts[0];
    const afterDot = parts[1];

    const paddedBefore = beforeDot.padStart(3, '0');
    const paddedAfter = afterDot.padEnd(4, '0');

    return `${paddedBefore}.${paddedAfter}`;
};

export default function MembersPage() {
  const { toast } = useToast();
  const { memberChanges, addMemberChange, deleteMemberChangesByDate, deleteAllMemberChanges } = useMember();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const userBranch = useMemo(() => {
    if (!branchesData || !currentUser || currentUser.role !== 'Branch User') return null;
    return branchesData.find(b => b.id === currentUser.assignment);
  }, [branchesData, currentUser]);
  
  const userVisibleGroups = useMemo(() => {
      if (!groupsData || !currentUser) return [];
      
      const { role, assignment } = currentUser;
      if (role === 'Super Admin' || role === 'Head Office') return groupsData;
      if (role === 'Branch User') {
          return groupsData.filter(g => g.branchId === assignment);
      }
      // For Area, Zonal, Regional roles, we need to filter down from their assignment
      // This part is simplified for now, assuming they can see all groups if not a branch user.
      // A more complex implementation would trace the hierarchy.
      return groupsData;
  }, [groupsData, currentUser]);


  // State for the entry form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryBranchId, setEntryBranchId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [added, setAdded] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [notes, setNotes] = useState('');

  // State for bulk upload
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
  const [skippedData, setSkippedData] = useState<{row: any, reason: string}[]>([]);
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);

  // State for the report
  const [searchDate, setSearchDate] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);
  
  // State for deletion
  const [isDeleteByDateOpen, setIsDeleteByDateOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'Branch User' && userBranch) {
      setEntryBranchId(userBranch.id);
      setFilterBranchId(userBranch.id);
    }
  }, [currentUser, userBranch]);
  
  const formGroups = useMemo(() => {
      if (!entryBranchId) return [];
      return groupsData?.filter(g => g.branchId === entryBranchId) || [];
  }, [entryBranchId, groupsData]);

  const handleAddChange = () => {
    if (!date || !groupId || (added === 0 && dropped === 0)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill out date, group, and at least one change (added/dropped).",
      });
      return;
    }

    const isDuplicate = memberChanges.some(c => c.date === date && c.groupId === groupId);
    if (isDuplicate) {
        toast({
            variant: "destructive",
            title: "Duplicate Entry",
            description: `An entry for this group on ${date} already exists. Please delete the existing entry to add a new one.`,
        });
        return;
    }

    addMemberChange({ date, groupId, added, dropped, notes });
    toast({
      title: "Change Recorded",
      description: `Member change for ${groupsData?.find(g => g.id === groupId)?.name} on ${date} has been saved.`
    });
    // Reset form
    if (currentUser?.role !== 'Branch User') setEntryBranchId('');
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
    const templateData = userVisibleGroups.map(g => ({
        GroupID: String(g.code).trim().toLowerCase(),
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
      toast({ variant: "destructive", title: "No file selected" });
      return;
    }
    if (!uploadDate) {
        toast({ variant: "destructive", title: "Date required", description: "Please select a date for the bulk upload." });
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
        
        const groupCodeMap = new Map(userVisibleGroups.map(g => [String(g.code).trim().toLowerCase(), g.id]));
        const existingEntries = new Set(memberChanges.filter(c => c.date === uploadDate).map(c => c.groupId));
        const processedInFile = new Set<string>();

        const validRows: UploadedRow[] = [];
        const skippedRows: { row: any, reason: string }[] = [];

        jsonData.forEach((row, index) => {
            const groupCode = row.GroupID ? String(row.GroupID).trim().toLowerCase() : '';
            if (!groupCode || (Number(row.MembersAdded) === 0 && Number(row.MembersDropped) === 0)) {
                return; // Skip empty or no-change rows
            }
            
            const formattedCode = formatGroupCode(groupCode);
            if (!groupCodeMap.has(formattedCode)) {
                skippedRows.push({ row, reason: `Group with code "${row.GroupID}" not found.` });
                return;
            }

            const groupId = groupCodeMap.get(formattedCode)!;

            if (existingEntries.has(groupId)) {
                skippedRows.push({ row, reason: `An entry for this group on ${uploadDate} already exists.` });
                return;
            }

            if (processedInFile.has(groupId)) {
                skippedRows.push({ row, reason: `Duplicate entry for this group within the file.` });
                return;
            }

            processedInFile.add(groupId);
            validRows.push({
                GroupID: groupId,
                GroupName: String(row.GroupName || userVisibleGroups.find(g => g.id === groupId)?.name || 'Unknown'),
                MembersAdded: Number(row.MembersAdded) || 0,
                MembersDropped: Number(row.MembersDropped) || 0,
                Notes: String(row.Notes || ''),
            });
        });

        if (validRows.length === 0 && skippedRows.length === 0) {
            toast({ variant: "destructive", title: "No Data Found", description: "The uploaded file appears to be empty or contains no valid data." });
            return;
        }

        setUploadedData(validRows);
        setSkippedData(skippedRows);
        setIsConfirmDialogOpen(true);

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ variant: "destructive", title: "Error reading file", description: "There was a problem processing the Excel file." });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = () => {
    let changesCount = 0;
    uploadedData.forEach(row => {
        addMemberChange({
            date: uploadDate,
            groupId: row.GroupID,
            added: row.MembersAdded,
            dropped: row.MembersDropped,
            notes: `Bulk upload: ${row.Notes || ''}`.trim(),
        });
        changesCount++;
    });

    toast({ title: "Bulk Upload Complete", description: `${changesCount} member changes have been recorded for ${uploadDate}.` });
    
    // Reset state
    setIsConfirmDialogOpen(false);
    setUploadedData([]);
    setSkippedData([]);
    setFile(null);
    const fileInput = document.getElementById('bulk-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
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

    const groupsForReport = filterBranchId === 'all' 
        ? userVisibleGroups
        : userVisibleGroups.filter(g => g.branchId === filterBranchId);

    const report = groupsForReport.map(group => {
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
  
  const handleDeleteDate = () => {
    if (!searchDate) {
      toast({ variant: "destructive", title: "No Date Selected", description: "Please select a date to delete." });
      return;
    }
    deleteMemberChangesByDate(searchDate);
    toast({ title: "Data Deleted", description: `All member change entries for ${searchDate} have been deleted.` });
    setIsDeleteByDateOpen(false);
    setReportData(null); // Refresh report view
  };

  const handleDeleteAll = () => {
    deleteAllMemberChanges();
    toast({ title: "All Data Deleted", description: "All member change entries have been deleted." });
    setIsDeleteAllOpen(false);
    setReportData(null); // Refresh report view
  };

  const isLoading = groupsLoading || branchesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Member Management</h1>
        <p className="text-muted-foreground">Record member changes and view daily balance reports.</p>
      </div>
      
      <div className="flex items-center gap-2">
         <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)} className="gap-1">
            <Trash2 className="h-4 w-4" />
            Delete All Data
        </Button>
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
              <Label htmlFor="entry-branch">Branch</Label>
              <Select onValueChange={(val) => { setEntryBranchId(val); setGroupId(''); }} value={entryBranchId} disabled={currentUser?.role === 'Branch User'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchesData?.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select onValueChange={setGroupId} value={groupId} disabled={!entryBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder={!entryBranchId ? "Select a branch first" : "Select a group"} />
                </SelectTrigger>
                <SelectContent>
                  {formGroups.map(g => (
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
            <Button onClick={handleAddChange} className="w-full" disabled={isLoading}>Save Change</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Member Changes</CardTitle>
            <CardDescription>Download the template, fill it out, and upload it here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button onClick={handleDownloadTemplate} variant="outline" className="w-full" disabled={isLoading}>
                <Download className="mr-2 h-4 w-4" />
                {isLoading ? "Loading..." : "Download Template"}
            </Button>
             <div className="space-y-2">
              <Label htmlFor="bulk-upload-date">Date for Upload</Label>
              <Input id="bulk-upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-upload">Upload Filled Template</Label>
              <Input id="bulk-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">
                File must be the downloaded template with your data filled in.
              </p>
            </div>
            <Button onClick={handleProcessUpload} className="w-full" disabled={!file || !uploadDate || isLoading}>
              <Upload className="mr-2 h-4 w-4" />
              {isLoading ? "Loading..." : "Upload and Preview"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Balance Report</CardTitle>
          <CardDescription>Select a date and branch to see the member balance for each group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-grow">
                <Label htmlFor="report-branch">Branch</Label>
                <Select onValueChange={setFilterBranchId} value={filterBranchId} disabled={currentUser?.role === 'Branch User'}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                        {currentUser?.role === 'Super Admin' && <SelectItem value="all">All Branches</SelectItem>}
                        {branchesData?.filter(b => currentUser?.role === 'Super Admin' || b.id === currentUser?.assignment).map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2 flex-grow">
              <Label htmlFor="search-date">Report Date</Label>
              <Input id="search-date" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
            <Button onClick={handleSearch} className="w-full sm:w-auto" disabled={isLoading}>Search</Button>
             {searchDate && <Button variant="destructive" onClick={() => setIsDeleteByDateOpen(true)} className="w-full sm:w-auto gap-1"><Trash2 className="h-4 w-4" />Delete Data for {searchDate}</Button>}
          </div>
          
          <div className="mt-6">
              {isLoading ? (
                 <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                 </div>
              ) : reportData ? (
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
                      <p>Please select a date and branch, then click "Search" to view the report.</p>
                  </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Upload</DialogTitle>
            <DialogDescription>
              Review the changes below. {skippedData.length > 0 ? "Some rows were skipped." : ""} Click "Confirm" to save.
            </DialogDescription>
          </DialogHeader>
          {skippedData.length > 0 && (
            <div className="my-4">
              <h3 className="font-semibold text-destructive">Skipped Rows</h3>
              <ScrollArea className="h-24 mt-2 rounded-md border p-2">
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {skippedData.map((item, i) => <li key={i}>{item.reason} (Row: {JSON.stringify(item.row)})</li>)}
                </ul>
              </ScrollArea>
            </div>
          )}
          <div className="my-4">
            <h3 className="font-semibold text-primary">Valid Rows to be Imported</h3>
            <ScrollArea className="h-48 mt-2">
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
            <Button onClick={handleConfirmUpload} disabled={uploadedData.length === 0}>Confirm & Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteByDateOpen} onOpenChange={setIsDeleteByDateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all member change entries for {searchDate}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDate} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL member change entries from the application. This is for clearing test data and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Yes, Delete Everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
