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
import { Upload, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import type { Group, LoanCollection } from '@/lib/data';

type ReportRow = LoanCollection & { groupName: string };

type UploadedRow = {
  GroupID: string;
  GroupName: string;
  Amount: number;
  Notes: string;
};

export default function LoanCollectionPage() {
  const { toast } = useToast();
  const { loanCollections, addLoanCollection } = useLoan();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const userVisibleGroups = useMemo(() => {
    if (!groupsData) return [];
    if (currentUser?.role === 'Super Admin') {
      return groupsData;
    }
    return groupsData.filter(g => g.responsibleEmployeeId === currentUser?.id);
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
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);

  // State for the report
  const [searchDate, setSearchDate] = useState('');
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);

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
        GroupID: g.id,
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

        const validData: UploadedRow[] = jsonData.filter(row => row.GroupID && Number(row.Amount) > 0).map(row => ({
            GroupID: String(row.GroupID),
            GroupName: String(row.GroupName || userVisibleGroups.find(g => g.id === String(row.GroupID))?.name || 'Unknown'),
            Amount: Number(row.Amount) || 0,
            Notes: String(row.Notes || ''),
        })).filter(row => userVisibleGroups.some(g => g.id === row.GroupID));

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
    let count = 0;
    uploadedData.forEach(row => {
        if (row.Amount > 0) {
            addLoanCollection({
                date: uploadDate,
                groupId: row.GroupID,
                amount: row.Amount,
                notes: `Bulk upload: ${row.Notes || ''}`.trim(),
            });
            count++;
        }
    });

    toast({ title: "Bulk Upload Successful", description: `${count} loan collections have been recorded for ${uploadDate}.` });
    
    // Reset state
    setIsConfirmDialogOpen(false);
    setUploadedData([]);
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Loan Collection</h1>
        <p className="text-muted-foreground">Record and manage loan collections from groups.</p>
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
              <Label htmlFor="bulk-upload-collection">Upload Filled Template</Label>
              <Input id="bulk-upload-collection" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
               <p className="text-xs text-muted-foreground">
                File must be the downloaded template with your data filled in.
              </p>
            </div>
            <Button onClick={handleProcessUpload} className="w-full" disabled={!file || groupsLoading}>
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
                          {reportData.map(row => (
                              <TableRow key={row.id}>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Collection</DialogTitle>
            <DialogDescription>
              Review the collections below. Select a date and click "Confirm" to save.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="space-y-2">
              <Label htmlFor="upload-date">Date for Collections</Label>
              <Input id="upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
            </div>
            <ScrollArea className="h-64">
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
            <Button onClick={handleConfirmUpload}>Confirm & Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
