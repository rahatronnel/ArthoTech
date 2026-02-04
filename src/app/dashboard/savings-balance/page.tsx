
"use client";

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSavings } from '@/context/SavingsContext';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isBefore } from 'date-fns';
import { Upload, Download, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import type { Group } from '@/lib/data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


type ReportRow = {
  groupId: string;
  groupName: string;
  openingBalance: number;
  depositedToday: number;
  withdrawnToday: number;
  closingBalance: number;
};

type UploadedRow = {
  GroupID: string;
  GroupName: string;
  Deposit: number;
  Withdraw: number;
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

export default function SavingsBalancePage() {
  const { toast } = useToast();
  const { savingsTransactions, addSavingsTransaction, deleteSavingsByDate, deleteAllSavings } = useSavings();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const userVisibleGroups = useMemo(() => {
    if (!groupsData || !currentUser) return [];
    
    const { role, assignment } = currentUser;
    if (role === 'Super Admin' || role === 'Head Office') return groupsData;
    if (role === 'Branch User') {
        return groupsData.filter(g => g.branchId === assignment);
    }
    // A more complex implementation for hierarchical roles would be needed here.
    return groupsData;
  }, [groupsData, currentUser]);
  
  // State for the entry form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [withdraw, setWithdraw] = useState(0);
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

  const reportTotals = useMemo(() => {
    if (!reportData) {
      return { opening: 0, deposited: 0, withdrawn: 0, closing: 0 };
    }
    return reportData.reduce(
      (acc, row) => {
        acc.opening += row.openingBalance;
        acc.deposited += row.depositedToday;
        acc.withdrawn += row.withdrawnToday;
        acc.closing += row.closingBalance;
        return acc;
      },
      { opening: 0, deposited: 0, withdrawn: 0, closing: 0 }
    );
  }, [reportData]);

  // State for deletion
  const [isDeleteByDateOpen, setIsDeleteByDateOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleAddTransaction = () => {
    if (!date || !groupId || (deposit === 0 && withdraw === 0)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill out date, group, and at least one transaction (deposit/withdraw).",
      });
      return;
    }
    const isDuplicate = savingsTransactions.some(t => t.date === date && t.groupId === groupId);
    if (isDuplicate) {
        toast({
            variant: "destructive",
            title: "Duplicate Entry",
            description: `A savings entry for this group on ${date} already exists.`,
        });
        return;
    }

    addSavingsTransaction({ date, groupId, deposit, withdraw, notes });
    toast({
      title: "Transaction Recorded",
      description: `Savings transaction for ${groupsData?.find(g => g.id === groupId)?.name} on ${date} has been saved.`
    });
    // Reset form
    setGroupId('');
    setDeposit(0);
    setWithdraw(0);
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
        Deposit: 0,
        Withdraw: 0,
        Notes: ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Savings");
    XLSX.writeFile(workbook, "SavingsTransactionsTemplate.xlsx");
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
        const existingEntries = new Set(savingsTransactions.filter(t => t.date === uploadDate).map(t => t.groupId));
        const processedInFile = new Set<string>();

        const validRows: UploadedRow[] = [];
        const skippedRows: { row: any, reason: string }[] = [];

        jsonData.forEach((row, index) => {
            const groupCode = row.GroupID ? String(row.GroupID).trim().toLowerCase() : '';
            if (!groupCode || (Number(row.Deposit) === 0 && Number(row.Withdraw) === 0)) {
                return; // Skip empty rows
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
                Deposit: Number(row.Deposit) || 0,
                Withdraw: Number(row.Withdraw) || 0,
                Notes: String(row.Notes || ''),
            });
        });

        if (validRows.length === 0 && skippedRows.length === 0) {
            toast({ variant: "destructive", title: "No Data Found", description: "The uploaded file contains no valid data." });
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
    let transactionsCount = 0;
    uploadedData.forEach(row => {
        addSavingsTransaction({
            date: uploadDate,
            groupId: row.GroupID,
            deposit: row.Deposit,
            withdraw: row.Withdraw,
            notes: `Bulk upload: ${row.Notes || ''}`.trim(),
        });
        transactionsCount++;
    });

    toast({ title: "Bulk Upload Successful", description: `${transactionsCount} savings transactions have been recorded for ${uploadDate}.` });
    
    // Reset state
    setIsConfirmDialogOpen(false);
    setUploadedData([]);
    setSkippedData([]);
    setFile(null);
    const fileInput = document.getElementById('bulk-upload-savings') as HTMLInputElement;
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

    const report = userVisibleGroups.map(group => {
        const openingBalance = group.initialSavings + savingsTransactions
            .filter(t => t.groupId === group.id && isBefore(parseISO(t.date), targetDate))
            .reduce((acc, t) => acc + t.deposit - t.withdraw, 0);

        const todaysTransactions = savingsTransactions.filter(t => t.groupId === group.id && t.date === searchDate);
        
        const depositedToday = todaysTransactions.reduce((sum, t) => sum + t.deposit, 0);
        const withdrawnToday = todaysTransactions.reduce((sum, t) => sum + t.withdraw, 0);
        
        const closingBalance = openingBalance + depositedToday - withdrawnToday;

        return {
            groupId: group.id,
            groupName: group.name,
            openingBalance,
            depositedToday,
            withdrawnToday,
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
    deleteSavingsByDate(searchDate);
    toast({ title: "Data Deleted", description: `All savings entries for ${searchDate} have been deleted.` });
    setIsDeleteByDateOpen(false);
    setReportData(null); // Refresh report view
  };

  const handleDeleteAll = () => {
    deleteAllSavings();
    toast({ title: "All Data Deleted", description: "All savings entries have been deleted." });
    setIsDeleteAllOpen(false);
    setReportData(null); // Refresh report view
  };


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Savings Balance Management</h1>
        <p className="text-muted-foreground">Record savings transactions and view daily balance reports.</p>
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
            <CardTitle>Add Savings Transaction</CardTitle>
            <CardDescription>Record deposits and withdrawals for a group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-date">Date</Label>
              <Input id="change-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit</Label>
                <Input id="deposit" type="number" min="0" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw">Withdrawal</Label>
                <Input id="withdraw" type="number" min="0" value={withdraw} onChange={(e) => setWithdraw(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."/>
            </div>
            <Button onClick={handleAddTransaction} className="w-full" disabled={groupsLoading}>Save Transaction</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Savings Transactions</CardTitle>
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
              <Label htmlFor="bulk-upload-savings">Upload Filled Template</Label>
              <Input id="bulk-upload-savings" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
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
          <CardTitle>Savings Balance Report</CardTitle>
          <CardDescription>Select a date to see the savings balance for each group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-grow">
              <Label htmlFor="search-date">Report Date</Label>
              <Input id="search-date" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
            <Button onClick={handleSearch} className="w-full sm:w-auto" disabled={groupsLoading}>Search</Button>
            {searchDate && <Button variant="destructive" onClick={() => setIsDeleteByDateOpen(true)} className="w-full sm:w-auto gap-1"><Trash2 className="h-4 w-4" />Delete Data for {searchDate}</Button>}
          </div>
          
          <div className="mt-6">
              {reportData ? (
                   <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead className="text-right">Opening Balance</TableHead>
                              <TableHead className="text-right">Deposited</TableHead>
                              <TableHead className="text-right">Withdrawn</TableHead>
                              <TableHead className="text-right">Closing Balance</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {reportData.map(row => (
                              <TableRow key={row.groupId}>
                                  <TableCell className="font-medium">{row.groupName}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(row.openingBalance)}</TableCell>
                                  <TableCell className="text-right text-green-600">+{formatCurrency(row.depositedToday)}</TableCell>
                                  <TableCell className="text-right text-red-600">-{formatCurrency(row.withdrawnToday)}</TableCell>
                                  <TableCell className="text-right font-bold">{formatCurrency(row.closingBalance)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                      {reportData.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-muted/80 hover:bg-muted">
                               <TableCell className="font-bold text-lg">Total</TableCell>
                               <TableCell className="text-right font-bold text-lg">{formatCurrency(reportTotals.opening)}</TableCell>
                               <TableCell className="text-right font-bold text-lg text-green-600">+{formatCurrency(reportTotals.deposited)}</TableCell>
                               <TableCell className="text-right font-bold text-lg text-red-600">-{formatCurrency(reportTotals.withdrawn)}</TableCell>
                               <TableCell className="text-right font-extrabold text-lg">{formatCurrency(reportTotals.closing)}</TableCell>
                            </TableRow>
                        </TableFooter>
                      )}
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Upload</DialogTitle>
            <DialogDescription>
              Review the transactions below. {skippedData.length > 0 ? "Some rows were skipped." : ""} Click "Confirm" to save.
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
                            <TableHead className="text-right">Deposit</TableHead>
                            <TableHead className="text-right">Withdrawal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {uploadedData.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell>{row.GroupName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.Deposit)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.Withdraw)}</TableCell>
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
              This will permanently delete all savings entries for {searchDate}. This action cannot be undone.
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
              This will permanently delete ALL savings entries from the application. This is for clearing test data and cannot be undone.
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

