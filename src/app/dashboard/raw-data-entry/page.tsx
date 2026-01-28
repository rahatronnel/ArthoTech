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

        const headerRow1 = [
            'Field Worker', null, 'Samity (Group)', null, 'Component', 'Savings Collection', 'Interest On Savings', 'Savings Refund', 'Additional Fees Collection', 'Disbursement Amount', 'Regular Recovarable', 'Loan Collection', null, null, null, null, null, null, 'Risk fund', 'Processing Fees / Form fees', 'Passbook fees', 'Admission fees', 'Total Collection'
        ];
        const headerRow2 = [
            'ID', 'Name', 'ID', 'Name', null, 'RS', 'RS', 'RS', null, null, null, 'Regular', 'Due', 'Advance', 'Rebate', 'Loan Received (principle)', 'Loan Received (Service Charge)', 'Total', null, null, null, null, null
        ];

        const dataRows = userVisibleGroups.map(group => {
            const fieldWorker = employees.find(e => e.id === group.responsibleEmployeeId);
            return [
                fieldWorker ? fieldWorker.id : 'N/A',
                fieldWorker ? fieldWorker.name : 'N/A',
                group.id,
                group.name,
                'General Loan',
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ];
        });

        const worksheetData = [headerRow1, headerRow2, ...dataRows];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        worksheet['!merges'] = [
            // s = start, e = end, r = row, c = col
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },  // Field Worker
            { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },  // Samity (Group)
            { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },  // Component
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
                const workbook = XLSX.read(data, { type: 'array', sheetRows: 2 }); // Read only first 2 rows for headers
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // We need to read the file again for the full data
                const fullWorkbook = XLSX.read(data, { type: 'array' });
                const fullWorksheet = fullWorkbook.Sheets[sheetName];
                const jsonData: UploadedRow[] = XLSX.utils.sheet_to_json(fullWorksheet, { header: 1, range: 1 }); // Range starts from second header row

                const header1 = (XLSX.utils.sheet_to_json(worksheet, {header: 1})[0] as string[]) || [];

                if (jsonData.length > 0) {
                     if (!header1.includes('Samity (Group)')) {
                         toast({ variant: "destructive", title: "Invalid File Format", description: "The file is missing the 'Samity (Group)' column." });
                         return;
                    }
                }
                
                const userVisibleGroupIds = currentUser?.role === 'Super Admin'
                    ? groups.map(g => g.id)
                    : groups.filter(g => g.responsibleEmployeeId === currentUser?.id).map(g => g.id);

                // Map headers from the file to our expected data structure
                const fileHeaders = jsonData[0] as string[];
                const samityIdIndex = fileHeaders.findIndex(h => h && h.toLowerCase().includes('id'));
                
                if (samityIdIndex === -1) {
                     toast({ variant: "destructive", title: "Invalid File Format", description: "Could not find 'Samity ID' column." });
                     return;
                }

                // data starts from the 3rd row in the sheet (index 2) but json_to_json with range:1 makes it start at index 1
                const validData = jsonData.slice(1).filter(row => {
                    const samityId = String((row as any[])[samityIdIndex]);
                    return userVisibleGroupIds.includes(samityId);
                }).map(row => {
                    const rowData: UploadedRow = {};
                    fileHeaders.forEach((header, index) => {
                        rowData[header] = (row as any[])[index];
                    });
                    return rowData;
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
                                    <TableHead className="text-center font-bold text-foreground border-r">Savings Collection</TableHead>
                                    <TableHead className="text-center font-bold text-foreground border-r">Interest On Savings</TableHead>
                                    <TableHead className="text-center font-bold text-foreground border-r">Savings Refund</TableHead>
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
