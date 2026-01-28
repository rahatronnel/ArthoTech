"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { employees, groups } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';

const columns: string[] = [
    'Field Worker ID',
    'Field Worker Name',
    'Samity ID',
    'Samity Name',
    'Component',
    'Savings Collection Amount',
    'Savings Collection RS',
    'Interest On Savings Amount',
    'Interest On Savings RS',
    'Savings Refund Amount',
    'Savings Refund RS',
    'Additional Fees Collection',
    'Disbursement Amount',
    'Regular Recovarable',
    'Regular',
    'Due',
    'Advance',
    'Rebate',
    'Loan Received (principle)',
    'Loan Received (Service Charge)',
    'Total',
    'Risk fund',
    'Processing Fees / Form fees',
    'Passbook fees',
    'Admission fees',
    'Total Collection',
];

type UploadedRow = { [key: string]: any };

export default function RawDataEntryPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleDownloadTemplate = () => {
        const userVisibleGroups = currentUser?.role === 'Super Admin' 
            ? groups
            : groups.filter(g => g.responsibleEmployeeId === currentUser?.id);

        if(userVisibleGroups.length === 0){
             toast({ variant: 'destructive', title: 'No Groups Found', description: 'There are no groups assigned to you to generate a template.' });
            return;
        }

        const templateData = userVisibleGroups.map(group => {
            const fieldWorker = employees.find(e => e.id === group.responsibleEmployeeId);
            const row: any = {};
            columns.forEach(col => {
                 if (col.endsWith(' RS')) {
                    row[col] = '';
                 } else {
                    row[col] = 0;
                 }
            });
            row['Field Worker ID'] = fieldWorker ? fieldWorker.id : 'N/A';
            row['Field Worker Name'] = fieldWorker ? fieldWorker.name : 'N/A';
            row['Samity ID'] = group.id;
            row['Samity Name'] = group.name;
            row['Component'] = 'General Loan'; // Default value
            
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(templateData, { header: columns });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Transactions");
        XLSX.writeFile(workbook, "DailyTransactionTemplate.xlsx");
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
                const jsonData: UploadedRow[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length > 0) {
                    const firstRow = jsonData[0];
                    if (!firstRow['Samity ID']) {
                         toast({ variant: "destructive", title: "Invalid File Format", description: "The file is missing the 'Samity ID' column." });
                         return;
                    }
                }
                
                const userVisibleGroupIds = currentUser?.role === 'Super Admin'
                    ? groups.map(g => g.id)
                    : groups.filter(g => g.responsibleEmployeeId === currentUser?.id).map(g => g.id);

                const validData = jsonData.filter(row => {
                    const samityId = String(row['Samity ID']);
                    return userVisibleGroupIds.includes(samityId);
                });

                if (validData.length === 0) {
                    toast({ variant: "destructive", title: "No Valid Data", description: "No data in the file corresponds to your assigned groups." });
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
        toast({ title: "Upload Confirmed", description: `${uploadedData.length} rows are ready for processing.` });
        
        setIsConfirmDialogOpen(false);
        setUploadedData([]);
        setFile(null);
        const fileInput = document.getElementById('raw-data-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };


    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Raw Data Entry</h1>
                <p className="text-muted-foreground">Download the daily transaction template, fill it out, and upload it here.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Daily Transactions</CardTitle>
                    <CardDescription>
                        Only data for groups assigned to you will be processed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                        <div className="space-y-2">
                            <Label htmlFor="raw-data-upload" className="sr-only">Upload File</Label>
                            <Input id="raw-data-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="file:text-foreground" />
                        </div>
                    </div>
                     <Button onClick={handleProcessUpload} className="w-full" disabled={!file}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload and Preview
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Excel Template Format</CardTitle>
                    <CardDescription>
                        Your Excel file must have the following columns in this exact order.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Field Worker</TableHead>
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Samity (Group)</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Component</TableHead>
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Savings Collection</TableHead>
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Interest On Savings</TableHead>
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Savings Refund</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Additional Fees Collection</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Disbursement Amount</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Regular Recovarable</TableHead>
                                    <TableHead colSpan={7} className="text-center font-bold text-foreground border-r">Loan Collection</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Risk fund</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Processing Fees / Form fees</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Passbook fees</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Admission fees</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground">Total Collection</TableHead>
                                </TableRow>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-bold text-foreground border-r">ID</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Name</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">ID</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Name</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Amount</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Amount</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Amount</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Regular</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Due</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Advance</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Rebate</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Loan Received (principle)</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Loan Received (Service Charge)</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                        Fill your daily transaction data here...
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <DialogTitle>Confirm Upload</DialogTitle>
                    <DialogDescription>Review the data below. Click "Confirm" to proceed with saving the data.</DialogDescription>
                </DialogHeader>
                 <ScrollArea className="h-[60vh]">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                {uploadedData.length > 0 && Object.keys(uploadedData[0]).map((key) => (
                                    <TableHead key={key}>{key}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedData.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {Object.values(row).map((cell, cellIndex) => (
                                        <TableCell key={cellIndex}>{String(cell)}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmUpload}>Confirm Upload</Button>
                </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

}
