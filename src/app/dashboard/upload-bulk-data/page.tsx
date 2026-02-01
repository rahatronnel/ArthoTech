
"use client";

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';
import { useOthersData } from '@/context/OthersDataContext';
import { type Branch, type OtherDataEntry, otherDataTypes as allDataTypes } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Trash2, Edit, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query } from 'firebase/firestore';


// These are the data types managed by THIS page's bulk upload template.
const templateDataTypes: Readonly<OtherDataEntry['type'][]> = ['Others Expenses', 'Cash', 'Bank', 'Afternoon Collection', 'Today Total Cash', 'Risk Fund', 'Processing Fee', 'Passbook Fee', 'Admission Fee'];

// Shape of a row in the uploaded Excel file
type UploadedRow = {
  Branch: string;
  'Others Expenses': number;
  Cash: number;
  Bank: number;
  'Afternoon Collection': number;
  'Today Total Cash': number;
  'Risk Fund': number;
  'Processing Fee': number;
  'Passbook Fee': number;
  'Admission Fee': number;
  Notes: string;
};

export default function OthersDataPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const { othersData, addBulkOthersData, updateOthersData, deleteOthersData, deleteAllOthersData, deleteOthersDataByDate } = useOthersData();

    const firestore = useFirestore();
    const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
    const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);
    const branches = branchesData || [];

    // State for filtering
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterBranch, setFilterBranch] = useState(currentUser?.role === 'Branch User' ? currentUser.assignment : '');
    
    // State for uploads
    const [file, setFile] = useState<File | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);

    // State for editing/deleting/adding
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<OtherDataEntry | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<OtherDataEntry | null>(null);
    const [isDeleteByDateOpen, setIsDeleteByDateOpen] = useState(false);
    const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);


    const userBranches = currentUser?.role === 'Super Admin' 
        ? branches 
        : branches.filter(b => b.name === currentUser?.assignment);

    if (currentUser?.role === 'Branch User' && !filterBranch) {
        setFilterBranch(currentUser.assignment);
    }
    
    const handleDownloadTemplate = () => {
        if (branchesLoading) {
            toast({ title: "Please wait", description: "Branches are loading..." });
            return;
        }

        const branchesForTemplate = filterBranch ? userBranches.filter(b => b.name === filterBranch) : userBranches;

        if (branchesForTemplate.length === 0) {
            toast({ variant: 'destructive', title: 'No branch selected', description: 'Please select a branch to download the template.' });
            return;
        }

        const templateData = branchesForTemplate.map(b => {
            const row: any = { 'Branch': b.name };
            templateDataTypes.forEach(dt => row[dt] = 0);
            row['Notes'] = '';
            return row;
        });
        
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Others Data');
        XLSX.writeFile(workbook, `Others_Data_Template.xlsx`);
        toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleProcessUpload = () => {
        if (!file) {
            toast({ variant: "destructive", title: "No file selected" });
            return;
        }

        if (branchesLoading) {
            toast({ title: "Please wait", description: "Branches are loading..." });
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

                const validData: UploadedRow[] = jsonData.filter(row => 
                    row.Branch &&
                    userBranches.some(b => b.name === row.Branch) && // Ensure branch is valid for user
                    templateDataTypes.some(dt => Number(row[dt]) > 0) // Ensure at least one value is present
                ).map(row => {
                    const newRow: any = { Branch: String(row.Branch), Notes: String(row.Notes || '') };
                    templateDataTypes.forEach(dt => {
                        newRow[dt] = Number(row[dt]) || 0;
                    });
                    return newRow as UploadedRow;
                });

                if (validData.length === 0) {
                    toast({ variant: "destructive", title: "Invalid File", description: "No valid data to process for your assigned branch(es)." });
                    return;
                }
                setUploadedData(validData);
                setIsConfirmDialogOpen(true);
            } catch (error) {
                console.error("Upload error:", error);
                toast({ variant: "destructive", title: "Error reading file" });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleConfirmUpload = () => {
        if (!uploadDate) {
            toast({ variant: "destructive", title: "Date required" });
            return;
        }
        
        const entriesToAdd: Omit<OtherDataEntry, 'id'>[] = [];
        uploadedData.forEach(row => {
            templateDataTypes.forEach(type => {
                const amount = row[type as keyof UploadedRow] as number;
                if (amount > 0) {
                    entriesToAdd.push({
                        date: uploadDate,
                        branch: row.Branch,
                        type: type,
                        amount: amount,
                        notes: row.Notes
                    });
                }
            });
        });

        if (entriesToAdd.length > 0) {
            addBulkOthersData(entriesToAdd);
            toast({ title: "Bulk Upload Successful", description: `${entriesToAdd.length} entries have been recorded.` });
        }
        
        // Reset state
        setIsConfirmDialogOpen(false);
        setUploadedData([]);
        setFile(null);
        const fileInput = document.getElementById('bulk-upload-others') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleEditClick = (entry: OtherDataEntry) => {
        setEditingEntry(entry);
    };

    const handleDeleteClick = (entry: OtherDataEntry) => {
        setEntryToDelete(entry);
    };
    
    const confirmDelete = () => {
        if (entryToDelete) {
            deleteOthersData(entryToDelete.id);
            toast({ title: "Entry deleted" });
            setEntryToDelete(null);
        }
    };
    
    const handleDeleteDate = () => {
      if (!filterDate) {
        toast({ variant: "destructive", title: "No Date Selected", description: "Please select a date to delete." });
        return;
      }
      deleteOthersDataByDate(filterDate);
      toast({ title: "Data Deleted", description: `All 'Others Data' entries for ${filterDate} have been deleted.` });
      setIsDeleteByDateOpen(false);
    };

    const handleDeleteAll = () => {
      deleteAllOthersData();
      toast({ title: "All Data Deleted", description: "All 'Others Data' entries have been deleted." });
      setIsDeleteAllOpen(false);
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    const filteredAndSortedData = othersData
        .filter(d => d.date === filterDate && (currentUser?.role === 'Super Admin' ? (filterBranch ? d.branch === filterBranch : true) : d.branch === currentUser?.assignment))
        .sort((a,b) => a.branch.localeCompare(b.branch) || allDataTypes.indexOf(a.type) - allDataTypes.indexOf(b.type));
    
    const AddEntryDialog = () => {
        const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
        const [branch, setBranch] = useState('');
        const [notes, setNotes] = useState('');
        const [amounts, setAmounts] = useState<Record<OtherDataEntry['type'], number>>(() => {
            const initialAmounts = {} as Record<OtherDataEntry['type'], number>;
            allDataTypes.forEach(type => {
                initialAmounts[type] = 0;
            });
            return initialAmounts;
        });

        const handleAmountChange = (type: OtherDataEntry['type'], value: string) => {
            setAmounts(prev => ({ ...prev, [type]: Number(value) || 0 }));
        };
        
        const handleSave = () => {
            if (!date || !branch) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please fill out date and branch.",
                });
                return;
            }

            const entriesToAdd: Omit<OtherDataEntry, 'id'>[] = [];
            for (const type of allDataTypes) {
                const amount = amounts[type as keyof typeof amounts];
                if (amount > 0) {
                    entriesToAdd.push({
                        date,
                        branch,
                        type: type as OtherDataEntry['type'],
                        amount,
                        notes,
                    });
                }
            }

            if (entriesToAdd.length === 0) {
                toast({
                    variant: "destructive",
                    title: "No data entered",
                    description: "Please enter an amount for at least one data type.",
                });
                return;
            }

            addBulkOthersData(entriesToAdd);
            toast({ title: `${entriesToAdd.length} entries added successfully.` });
            setIsAddDialogOpen(false);
        };

        return (
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Branch Data</DialogTitle>
                        <DialogDescription>Manually record all 'Others Data' for a single branch and date at once.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-date">Date</Label>
                                <Input id="new-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-branch">Branch</Label>
                                <Select onValueChange={setBranch} value={branch}>
                                    <SelectTrigger><SelectValue placeholder="Select a branch" /></SelectTrigger>
                                    <SelectContent>
                                        {userBranches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <ScrollArea className="h-72 pr-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                {allDataTypes.map(type => (
                                    <div className="space-y-2" key={type}>
                                        <Label htmlFor={`amount-${type}`}>{type}</Label>
                                        <Input
                                            id={`amount-${type}`}
                                            type="number"
                                            value={amounts[type as keyof typeof amounts] === 0 ? '' : amounts[type as keyof typeof amounts]}
                                            onChange={e => handleAmountChange(type as OtherDataEntry['type'], e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                         <div className="space-y-2">
                            <Label htmlFor="new-notes">Notes (Optional)</Label>
                            <Input id="new-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note for all entries"/>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Entries</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const EditDialog = () => {
        const [amount, setAmount] = useState(editingEntry?.amount || 0);
        const [notes, setNotes] = useState(editingEntry?.notes || '');
        
        const handleSubmit = () => {
            if (editingEntry && amount >= 0) {
                updateOthersData(editingEntry.id, { amount, notes });
                toast({ title: "Entry updated" });
                setEditingEntry(null);
            } else {
                toast({ variant: "destructive", title: "Invalid amount" });
            }
        };

        return (
            <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Entry for {editingEntry?.type}</DialogTitle>
                        <DialogDescription>Branch: {editingEntry?.branch} on {editingEntry?.date}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-amount">Amount</Label>
                            <Input id="edit-amount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Notes</Label>
                            <Input id="edit-notes" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
                        <Button onClick={handleSubmit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Others Data Entry</h1>
                <p className="text-muted-foreground">Manage other financial data for each branch.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Add New Entry
                </Button>
                <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)} className="gap-1">
                    <Trash2 className="h-4 w-4" />
                    Delete All Data
                </Button>
            </div>


             <Card>
                <CardHeader>
                    <CardTitle>Filter Data</CardTitle>
                    <CardDescription>Select a date and branch to view or manage data.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="space-y-2 flex-grow">
                        <Label htmlFor="filter-date">Date</Label>
                        <Input id="filter-date" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                    </div>
                    {currentUser?.role === 'Super Admin' && (
                        <div className="space-y-2 flex-grow">
                            <Label htmlFor="filter-branch">Branch</Label>
                            <Select onValueChange={(value) => setFilterBranch(value === 'all-branches' ? '' : value)} value={filterBranch || 'all-branches'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Branches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all-branches">All Branches</SelectItem>
                                    {branches.map(b => (
                                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                     <Button variant="destructive" onClick={() => setIsDeleteByDateOpen(true)} className="w-full sm:w-auto gap-1" disabled={!filterDate}>
                        <Trash2 className="h-4 w-4" />
                        Delete Data for {filterDate}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Bulk Upload Data</CardTitle>
                        <CardDescription>Download a template, fill it with data for one or more branches, and upload it.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleDownloadTemplate} variant="outline" className="w-full" disabled={branchesLoading}>
                            <Download className="mr-2 h-4 w-4" /> {branchesLoading ? 'Loading...' : 'Download Template'}
                        </Button>
                        <div className="space-y-2">
                            <Label htmlFor="bulk-upload-others">Upload Filled Template</Label>
                            <Input id="bulk-upload-others" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="file:text-foreground" />
                        </div>
                        <Button onClick={handleProcessUpload} className="w-full" disabled={!file || branchesLoading}>
                            <Upload className="mr-2 h-4 w-4" />
                            {branchesLoading ? 'Loading Branches...' : 'Upload and Preview'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Daily Summary</CardTitle>
                        <CardDescription>Total amounts for {filterDate} {filterBranch && ` at ${filterBranch}`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data Type</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allDataTypes.map(type => {
                                    const total = filteredAndSortedData
                                        .filter(d => d.type === type)
                                        .reduce((sum, d) => sum + d.amount, 0);
                                    
                                    if(total === 0) return null;

                                    return (
                                        <TableRow key={type}>
                                            <TableCell className="font-medium">{type}</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>All Entries for {filterDate}</CardTitle>
                    <CardDescription>Detailed list of all data entries recorded for the selected date and branch(es).</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedData.map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{entry.branch}</TableCell>
                                    <TableCell>{entry.type}</TableCell>
                                    <TableCell>{entry.notes}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(entry)}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(entry)} className="text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {filteredAndSortedData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No data for the selected criteria.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            {/* Upload Confirmation Dialog */}
            <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Confirm Bulk Upload</DialogTitle>
                    <DialogDescription>Review the data below. Select a date and click "Confirm" to save.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="upload-date">Date for Uploads</Label>
                        <Input id="upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
                    </div>
                    <ScrollArea className="h-64">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Branch</TableHead>
                                    {templateDataTypes.map(dt => <TableHead key={dt} className="text-right">{dt}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploadedData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{row.Branch}</TableCell>
                                        {templateDataTypes.map(dt => <TableCell key={dt} className="text-right">{formatCurrency(row[dt] as number)}</TableCell>)}
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

            {/* Add/Edit Dialogs */}
            {isAddDialogOpen && <AddEntryDialog />}
            {editingEntry && <EditDialog />}
            
            <AlertDialog open={isDeleteByDateOpen} onOpenChange={setIsDeleteByDateOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all 'Others Data' entries for {filterDate}. This action cannot be undone.
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
                      This will permanently delete ALL 'Others Data' entries from the application. This is for clearing test data and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Yes, Delete Everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

             <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the entry.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

