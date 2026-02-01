
"use client";

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLoan } from '@/context/LoanContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import type { Group, LoanCollection } from '@/lib/data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ReportRow = LoanCollection & { groupName: string };

type UploadedRow = {
  GroupID: string;
  GroupName: string;
  Amount: number;
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

export default function LoanCollectionPage() {
  const { toast } = useToast();
  const { loanCollections, addLoanCollection, deleteAllCollections, deleteCollectionsByDate } = useLoan();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const userVisibleGroups = useMemo(() => {
    if (!groupsData || !currentUser) return [];
    if (currentUser.role === 'Super Admin' || currentUser.role === 'Head Office') {
      return groupsData;
    }
    if (currentUser.role === 'Branch User') {
      return groupsData.filter(g => g.branchId === currentUser.assignment);
    }
    // A more complex implementation for hierarchical roles would be needed here.
    return groupsData;
  }, [groupsData, currentUser]);
  
  // State for the entry form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // State for bulk upload
  const [file, setFile] = useState<File | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
  const [skippedData, setSkippedData] = useState<{row: any, reason: string}[]>([]);
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);

  // State for the report
  const [searchDate, setSearchDate] = useState('');
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);

  // State for deletion
  const [isDeleteByDateOpen, setIsDeleteByDateOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const handleAddCollection = () => {
    if (!date || !groupId || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill out date, group, and a valid amount.",
      });
      return;
    }
    const isDuplicate = loanCollections.some(c => c.date === date && c.groupId === groupId);
    if(isDuplicate) {
        toast({
            variant: "destructive",
            title: "Duplicate Entry",
            description: `A collection for this group on ${date} already exists.`,
        });
        return;
    }

    addLoanCollection({ date, groupId, amount, notes });
    toast({
      title: "Collection Recorded",
      description: `Loan collection for ${groupsData?.find(g => g.id === groupId)?.name} on ${date} has been saved.`
    });
    // Reset form
    setGroupId('');
    setAmount(0);
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
        Amount: 0,
        Notes: ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Collections");
    XLSX.writeFile(workbook, "LoanCollectionsTemplate.xlsx");
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
        const existingEntries = new Set(loanCollections.filter(c => c.date === uploadDate).map(c => c.groupId));
        const processedInFile = new Set<string>();

        const validRows: UploadedRow[] = [];
        const skippedRows: { row: any, reason: string }[] = [];

        jsonData.forEach(row => {
            const groupCode = row.GroupID ? String(row.GroupID).trim().toLowerCase() : '';
            if (!groupCode || Number(row.Amount) <= 0) {
                return; // Skip empty or zero-amount rows
            }
            
            const formattedCode = formatGroupCode(groupCode);
            if (!groupCodeMap.has(formattedCode)) {
                skippedRows.push({ row, reason: `Group with code "${row.GroupID}" not found.` });
                return;
            }

            const groupId = groupCodeMap.get(formattedCode)!;

            if (existingEntries.has(groupId)) {
                skippedRows.push({ row, reason: `A collection for this group on ${uploadDate} already exists.` });
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
                Amount: Number(row.Amount) || 0,
                Notes: String(row.Notes || ''),
            });
        });

        if (validRows.length === 0 && skippedRows.length === 0) {
            toast({ variant: "destructive", title: "No Data Found", description: "The uploaded file has no valid data." });
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
    let count = 0;
    uploadedData.forEach(row => {
        addLoanCollection({
            date: uploadDate,
            groupId: row.GroupID,
            amount: row.Amount,
            notes: `Bulk upload: ${row.Notes || ''}`.trim(),
        });
        count++;
    });

    toast({ title: "Bulk Upload Successful", description: `${count} loan collections have been recorded for ${uploadDate}.` });
    
    // Reset state
    setIsConfirmDialogOpen(false);
    setUploadedData([]);
    setSkippedData([]);
    setFile(null);
    const fileInput = document.getElementById('bulk-upload-collection') as HTMLInputElement;
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
    
    const dailyReport = loanCollections
        .filter(c => c.date === searchDate && userVisibleGroups.some(g => g.id === c.groupId))
        .map(c => ({
            ...c,
            groupName: groupsData?.find(g => g.id === c.groupId)?.name || 'Unknown Group'
        }));

    setReportData(dailyReport);
  };
  
  const handleDeleteDate = () => {
    if (!searchDate) {
      toast({ variant: "destructive", title: "No Date Selected", description: "Please select a date to delete." });
      return;
    }
    deleteCollectionsByDate(searchDate);
    toast({ title: "Data Deleted", description: `All collection entries for ${searchDate} have been deleted.` });
    setIsDeleteByDateOpen(false);
    setReportData(null); // Refresh report view
  };

  const handleDeleteAll = () => {
    deleteAllCollections();
    toast({ title: "All Data Deleted", description: "All collection entries have been deleted." });
    setIsDeleteAllOpen(false);
    setReportData(null); // Refresh report view
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Loan Collection</h1>
        <p className="text-muted-foreground">Record and manage loan collections from groups.</p>
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
            <CardTitle>Add Loan Collection</CardTitle>
            <CardDescription>Record a single loan collection from a group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-date">Date</Label>
              <Input id="collection-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select onValueChange={setGroupId} value={groupId} disabled={groupsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={groupsLoading ? "Loading..." : "Select a group"} />
                </SelectTrigger>
                <SelectContent>
                  {userVisibleGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."/>
            </div>
            <Button onClick={handleAddCollection} className="w-full" disabled={groupsLoading}>Save Collection</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Collections</CardTitle>
            <CardDescription>Download the template, fill it out, and upload it here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full" disabled={groupsLoading}>
                <Download className="mr-2 h-4 w-4" />
                {groupsLoading ? "Loading..." : "Download Template"}
            </Button>
             <div className="space-y-2">
              <Label htmlFor="bulk-upload-date">Date for Upload</Label>
              <Input id="bulk-upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-upload-collection">Upload Filled Template</Label>
              <Input id="bulk-upload-collection" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
               <p className="text-xs text-muted-foreground">
                File must be the downloaded template with your data filled in.
              </p>
            </div>
            <Button onClick={handleProcessUpload} className="w-full" disabled={!file || !uploadDate || groupsLoading}>
              <Upload className="mr-2 h-4 w-4" />
              {groupsLoading ? "Loading..." : "Upload and Preview"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Collection Report</CardTitle>
          <CardDescription>Select a date to see all loan collections for that day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-grow">
              <Label htmlFor="search-date">Report Date</Label>
              <Input id="search-date" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
            <Button onClick={handleSearch} className="w-full sm:w-auto">Search</Button>
             {searchDate && <Button variant="destructive" onClick={() => setIsDeleteByDateOpen(true)} className="w-full sm:w-auto gap-1"><Trash2 className="h-4 w-4" />Delete Data for {searchDate}</Button>}
          </div>
          
          <div className="mt-6">
              {reportData ? (
                reportData.length > 0 ? (
                   <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead className="text-right">Amount Collected</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {reportData.map((row, index) => (
                              <TableRow key={index}>
                                  <TableCell className="font-medium">{row.groupName}</TableCell>
                                  <TableCell>{row.notes}</TableCell>
                                  <TableCell className="text-right font-bold">{formatCurrency(row.amount)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No collections found for {searchDate}.</p>
                  </div>
                )
              ) : (
                  <div className="text-center py-10 text-muted-foreground">
                      <p>Please select a date and click "Search" to view the report.</p>
                  </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Collection</DialogTitle>
            <DialogDescription>
              Review the collections below. {skippedData.length > 0 ? "Some rows were skipped." : ""} Click "Confirm" to save.
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
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {uploadedData.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell>{row.GroupName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.Amount)}</TableCell>
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
              This will permanently delete all collection entries for {searchDate}. This action cannot be undone.
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
              This will permanently delete ALL collection entries from the application. This is for clearing test data and cannot be undone.
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
