"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';
import { useOthersData } from '@/context/OthersDataContext';
import { branches, OtherDataEntry } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type DataType = 'Others Expenses' | 'Cash' | 'Bank' | 'Afternoon Collection' | 'Today Total Cash';
const dataTypes: DataType[] = ['Others Expenses', 'Cash', 'Bank', 'Afternoon Collection', 'Today Total Cash'];

type UploadedRow = {
  Branch: string;
  Amount: number;
  Notes: string;
};

export default function OthersDataPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const { othersData, addBulkOthersData, updateOthersData, deleteOthersData } = useOthersData();

    // State for filtering
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterBranch, setFilterBranch] = useState(currentUser?.role === 'Branch User' ? currentUser.assignment : '');
    
    // State for uploads
    const [file, setFile] = useState<File | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentDataType, setCurrentDataType] = useState<DataType>('Others Expenses');

    // State for editing/deleting
    const [editingEntry, setEditingEntry] = useState<OtherDataEntry | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<OtherDataEntry | null>(null);


    const userBranches = currentUser?.role === 'Super Admin' 
        ? branches 
        : branches.filter(b => b.name === currentUser?.assignment);

    if (currentUser?.role === 'Branch User' && !filterBranch) {
        setFilterBranch(currentUser.assignment);
    }
    
    const handleDownloadTemplate = (dataType: DataType) => {
        const templateData = userBranches.map(b => ({
            Branch: b.name,
            Amount: 0,
            Notes: ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, dataType);
        XLSX.writeFile(workbook, `${dataType.replace(/ /g, '_')}_Template.xlsx`);
        toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleProcessUpload = (dataType: DataType) => {
        if (!file) {
            toast({ variant: "destructive", title: "No file selected" });
            return;
        }
        setCurrentDataType(dataType);
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
                    Number(row.Amount) > 0 &&
                    userBranches.some(b => b.name === row.Branch) // Ensure branch is valid for user
                ).map(row => ({
                    Branch: String(row.Branch),
                    Amount: Number(row.Amount) || 0,
                    Notes: String(row.Notes || ''),
                }));

                if (validData.length === 0) {
                    toast({ variant: "destructive", title: "Invalid File", description: "No valid data to process for your assigned branch(es)." });
                    return;
                }
                setUploadedData(validData);
                setIsConfirmDialogOpen(true);
            } catch (error) {
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
        const entriesToAdd = uploadedData.map(row => ({
            date: uploadDate,
            branch: row.Branch,
            type: currentDataType,
            amount: row.Amount,
            notes: row.Notes
        }));
        addBulkOthersData(entriesToAdd);
        toast({ title: "Bulk Upload Successful", description: `${entriesToAdd.length} entries for ${currentDataType} have been recorded.` });
        
        // Reset state
        setIsConfirmDialogOpen(false);
        setUploadedData([]);
        setFile(null);
        const fileInput = document.getElementById(`bulk-upload-${currentDataType}`) as HTMLInputElement;
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
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    const filteredAndSortedData = othersData
        .filter(d => d.date === filterDate && (currentUser?.role === 'Super Admin' ? (filterBranch ? d.branch === filterBranch : true) : d.branch === currentUser?.assignment))
        .sort((a,b) => a.branch.localeCompare(b.branch));

    const DataTabContent = ({ dataType }: { dataType: DataType }) => (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload for {dataType}</CardTitle>
                    <CardDescription>Upload a filled Excel file to add data in bulk.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => handleDownloadTemplate(dataType)} variant="outline" className="w-full">
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <div className="space-y-2">
                        <Label htmlFor={`bulk-upload-${dataType}`}>Upload Filled Template</Label>
                        <Input id={`bulk-upload-${dataType}`} type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="file:text-foreground" />
                    </div>
                    <Button onClick={() => handleProcessUpload(dataType)} className="w-full" disabled={!file}>
                        <Upload className="mr-2 h-4 w-4" /> Upload and Preview
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Daily Entries for {dataType}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedData.filter(d => d.type === dataType).map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell>{entry.branch}</TableCell>
                                    <TableCell>{entry.notes}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => handleEditClick(entry)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDeleteClick(entry)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredAndSortedData.filter(d => d.type === dataType).length === 0 && <p className="text-center text-muted-foreground p-4">No data for the selected criteria.</p>}
                </CardContent>
            </Card>
        </div>
    );
    
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

             <Card>
                <CardHeader>
                    <CardTitle>Filter Data</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="space-y-2 flex-grow">
                        <Label htmlFor="filter-date">Date</Label>
                        <Input id="filter-date" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                    </div>
                    {currentUser?.role === 'Super Admin' && (
                        <div className="space-y-2 flex-grow">
                            <Label htmlFor="filter-branch">Branch</Label>
                            <Select onValueChange={(value) => setFilterBranch(value === 'all-branches' ? '' : value)} value={filterBranch}>
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
                </CardContent>
            </Card>

            <Tabs defaultValue="Others Expenses" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {dataTypes.map(dt => <TabsTrigger key={dt} value={dt}>{dt}</TabsTrigger>)}
                </TabsList>
                {dataTypes.map(dt => (
                    <TabsContent key={dt} value={dt}>
                        <DataTabContent dataType={dt} />
                    </TabsContent>
                ))}
            </Tabs>
            
            {/* Upload Confirmation Dialog */}
            <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Confirm Bulk Upload for {currentDataType}</DialogTitle>
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
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploadedData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{row.Branch}</TableCell>
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

            {/* Edit Dialog */}
            {editingEntry && <EditDialog />}

            {/* Delete Confirmation */}
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
