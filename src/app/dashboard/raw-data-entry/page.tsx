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

type UploadedRow = {
  'Field Worker ID': string;
  'Field Worker Name': string;
  'Samity ID': string;
  'Samity Name': string;
  'Component': string;
  'Savings Collection': number;
  'Interest On Savings': number;
  'Savings Refund': number;
  'Additional Fees Collection': number;
  'Disbursement Amount': number;
  'Regular Recovarable': number;
  'Loan Collection Regular': number;
  'Loan Collection Due': number;
  'Loan Collection Advance': number;
  'Loan Collection Rebate': number;
  'Loan Received (principle)': number;
  'Loan Received (Service Charge)': number;
  'Loan Collection Total': number;
  'Risk fund': number;
  'Processing Fees / Form fees': number;
  'Passbook fees': number;
  'Admission fees': number;
  'Total Collection': number;
};


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

        const headerRow1 = [
            'Field Worker', null, 'Samity (Group)', null, 'Component', 'Savings Collection', 'Interest On Savings', 'Savings Refund', 'Additional Fees Collection', 'Disbursement Amount', 'Regular Recovarable', 'Loan Collection', null, null, null, null, null, null, 'Risk fund', 'Processing Fees / Form fees', 'Passbook fees', 'Admission fees', 'Total Collection'
        ];
        const headerRow2 = [
            'ID', 'Name', 'ID', 'Name', null, 'RS', 'RS', 'RS', null, null, null, 'Regular', 'Due', 'Advance', 'Rebate', 'Loan Received (principle)', 'Loan Received (Service Charge)', 'Total', null, null, null, null, null
        ];

        const dataRows = userVisibleGroups.map(group => {
            const fieldWorker = employees.find(e => e.id === group.responsibleEmployeeId);
            const row = [
                fieldWorker ? fieldWorker.id : 'N/A',
                fieldWorker ? fieldWorker.name : 'N/A',
                group.id,
                group.name,
                'General Loan',
                0, // Savings Collection
                0, // Interest On Savings
                0, // Savings Refund
                0, // Additional Fees Collection
                0, // Disbursement Amount
                0, // Regular Recovarable
                0, // Loan Collection - Regular
                0, // Loan Collection - Due
                0, // Loan Collection - Advance
                0, // Loan Collection - Rebate
                0, // Loan Collection - Principle
                0, // Loan Collection - Service Charge
                0, // Loan Collection - Total
                0, // Risk fund
                0, // Processing Fees
                0, // Passbook fees
                0, // Admission fees
                0, // Total Collection
            ];
            return row;
        });

        const worksheetData = [headerRow1, headerRow2, ...dataRows];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        worksheet['!merges'] = [
            // s = start, e = end, r = row, c = col
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },  // Field Worker
            { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },  // Samity (Group)
            { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },  // Component
            { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },  // Savings Collection
            { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },  // Interest on Savings
            { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },  // Savings Refund
            { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },  // Additional Fees Collection
            { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } },  // Disbursement Amount
            { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } },// Regular Recovarable
            { s: { r: 0, c: 11 }, e: { r: 0, c: 17 } },// Loan Collection
            { s: { r: 0, c: 18 }, e: { r: 1, c: 18 } },// Risk fund
            { s: { r: 0, c: 19 }, e: { r: 1, c: 19 } },// Processing Fees / Form fees
            { s: { r: 0, c: 20 }, e: { r: 1, c: 20 } },// Passbook fees
            { s: { r: 0, c: 21 }, e: { r: 1, c: 21 } },// Admission fees
            { s: { r: 0, c: 22 }, e: { r: 1, c: 22 } },// Total Collection
        ];
        
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
                
                const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
                
                const dataRows = rawData.slice(2);

                const userVisibleGroupIds = new Set(
                    (currentUser?.role === 'Super Admin'
                        ? groups
                        : groups.filter(g => g.responsibleEmployeeId === currentUser?.id)
                    ).map(g => g.id)
                );

                const processedData: UploadedRow[] = dataRows.map(row => {
                    return {
                        'Field Worker ID': String(row[0] || ''),
                        'Field Worker Name': String(row[1] || ''),
                        'Samity ID': String(row[2] || ''),
                        'Samity Name': String(row[3] || ''),
                        'Component': String(row[4] || ''),
                        'Savings Collection': Number(row[5]) || 0,
                        'Interest On Savings': Number(row[6]) || 0,
                        'Savings Refund': Number(row[7]) || 0,
                        'Additional Fees Collection': Number(row[8]) || 0,
                        'Disbursement Amount': Number(row[9]) || 0,
                        'Regular Recovarable': Number(row[10]) || 0,
                        'Loan Collection Regular': Number(row[11]) || 0,
                        'Loan Collection Due': Number(row[12]) || 0,
                        'Loan Collection Advance': Number(row[13]) || 0,
                        'Loan Collection Rebate': Number(row[14]) || 0,
                        'Loan Received (principle)': Number(row[15]) || 0,
                        'Loan Received (Service Charge)': Number(row[16]) || 0,
                        'Loan Collection Total': Number(row[17]) || 0,
                        'Risk fund': Number(row[18]) || 0,
                        'Processing Fees / Form fees': Number(row[19]) || 0,
                        'Passbook fees': Number(row[20]) || 0,
                        'Admission fees': Number(row[21]) || 0,
                        'Total Collection': Number(row[22]) || 0,
                    };
                }).filter(row => userVisibleGroupIds.has(row['Samity ID']));


                if (processedData.length === 0) {
                    toast({ variant: "destructive", title: "No Valid Data", description: "No data in the file corresponds to your assigned groups, or the file is empty." });
                    return;
                }

                setUploadedData(processedData);
                setIsConfirmDialogOpen(true);

            } catch (error) {
                console.error("Error parsing Excel file:", error);
                toast({ variant: "destructive", title: "Error reading file", description: "There was a problem processing the Excel file. Please ensure it matches the template." });
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
                        Your Excel file must follow this structure. Use the download button to get a pre-filled template.
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
                                    <TableHead colSpan={1} className="text-center font-bold text-foreground border-r">Savings Collection</TableHead>
                                    <TableHead colSpan={1} className="text-center font-bold text-foreground border-r">Interest On Savings</TableHead>
                                    <TableHead colSpan={1} className="text-center font-bold text-foreground border-r">Savings Refund</TableHead>
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
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
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
                                    <TableCell colSpan={23} className="h-24 text-center text-muted-foreground">
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
                                    <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedData.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {Object.values(row).map((cell, cellIndex) => (
                                        <TableCell key={cellIndex} className="whitespace-nowrap">{String(cell)}</TableCell>
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
