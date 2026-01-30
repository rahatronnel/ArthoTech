
"use client";

import * as React from 'react';
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';
import { useOthersData } from '@/context/OthersDataContext';
import { type Branch, type OtherDataEntry, type Group, type Employee } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, CheckCircle, Wallet, Landmark, Users, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useSavings } from '@/context/SavingsContext';
import { useLoan } from '@/context/LoanContext';
import { useMember } from '@/context/MemberContext';
import { collection, collectionGroup, query } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { parseTransactions } from '@/ai/flows/parse-transactions-flow';


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


export default function RawDataEntryPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const { addSavingsTransaction } = useSavings();
    const { addLoanDisbursement, addLoanCollection } = useLoan();
    const { addBulkOthersData } = useOthersData();
    const { addMemberChange } = useMember();

    const [file, setFile] = useState<File | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
    const [wizardStep, setWizardStep] = useState(0);
    const [isParsing, setIsParsing] = useState(false);


    const firestore = useFirestore();

    const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
    const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);
    
    const employeesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'employees'): null, [firestore]);
    const { data: employeesData, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

    const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
    const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

    const userVisibleGroups = useMemo(() => {
        if (!groupsData || !currentUser) return [];
        if (currentUser.role === 'Super Admin') {
            return groupsData;
        }
        return groupsData.filter(g => g.responsibleEmployeeId === currentUser.id);
    }, [groupsData, currentUser]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleDownloadTemplate = () => {
       const headerRow1 = [
            'Field Worker', null, 'Samity', null, 'Component', 'Savings Collection', 'Interest On Savings', 'Savings Refund', 'Additional Fees Collection', 'Disbursement Amount', 'Regular Recovarable', 'Loan Collection', null, null, null, null, null, null, 'Risk fund', 'Processing Fees / Form fees', 'Passbook fees', 'Admission fees', 'Total Collection'
        ];
        const headerRow2 = [
            'ID', 'Name', 'ID', 'Name', null, 'RS', 'RS', 'RS', null, null, null, 'Regular', 'Due', 'Advance', 'Rebate', 'Total Collection', null, null, null, null, null, null, null
        ];
        const headerRow3 = [
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Loan Received (principle)', 'Loan Received (Service Charge)', 'Total', null, null, null, null, null
        ];

        const worksheetData = [headerRow1, headerRow2, headerRow3];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        worksheet['!merges'] = [
            // s = start, e = end, r = row, c = col
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },  // Field Worker
            { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },  // Field Worker ID
            { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },  // Field Worker Name
            { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },  // Samity
            { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },  // Samity ID
            { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },  // Samity Name
            { s: { r: 0, c: 4 }, e: { r: 2, c: 4 } },  // Component
            { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },  // Savings Collection
            { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },  // Interest On Savings
            { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },  // Savings Refund
            { s: { r: 0, c: 8 }, e: { r: 2, c: 8 } },  // Additional Fees Collection
            { s: { r: 0, c: 9 }, e: { r: 2, c: 9 } },  // Disbursement Amount
            { s: { r: 0, c: 10 }, e: { r: 2, c: 10 } },// Regular Recovarable
            { s: { r: 0, c: 11 }, e: { r: 0, c: 17 } },// Loan Collection
            { s: { r: 1, c: 11 }, e: { r: 2, c: 11 } },// Regular
            { s: { r: 1, c: 12 }, e: { r: 2, c: 12 } },// Due
            { s: { r: 1, c: 13 }, e: { r: 2, c: 13 } },// Advance
            { s: { r: 1, c: 14 }, e: { r: 2, c: 14 } },// Rebate
            { s: { r: 1, c: 15 }, e: { r: 1, c: 17 } },// Total Collection (under loan)
            { s: { r: 2, c: 15 }, e: { r: 2, c: 15 } }, // Loan Received (principle)
            { s: { r: 2, c: 16 }, e: { r: 2, c: 16 } }, // Loan Received (Service Charge)
            { s: { r: 2, c: 17 }, e: { r: 2, c: 17 } }, // Total
            { s: { r: 0, c: 18 }, e: { r: 2, c: 18 } },// Risk fund
            { s: { r: 0, c: 19 }, e: { r: 2, c: 19 } },// Processing Fees / Form fees
            { s: { r: 0, c: 20 }, e: { r: 2, c: 20 } },// Passbook fees
            { s: { r: 0, c: 21 }, e: { r: 2, c: 21 } },// Admission fees
            { s: { r: 0, c: 22 }, e: { r: 2, c: 22 } },// Total Collection (final)
        ];
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Transactions");
        XLSX.writeFile(workbook, "DailyTransactionTemplate.xlsx");
        toast({ title: "Template Downloaded", description: "Please fill out the blank template and upload it." });
    };

    const processExcel = (excelFile: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                const dataRows = rawData.slice(3);
                
                const allTransactions: UploadedRow[] = [];
                let lastFieldWorkerId = '';
                let lastFieldWorkerName = '';
                let lastSamityId = '';
                let lastSamityName = '';

                for (const row of dataRows) {
                    if (!row || row.length === 0 || row.every(cell => cell === null || cell === '')) {
                        continue;
                    }

                    // Stop processing if we hit a summary row
                    const samityNameCell = String(row[3] || '').trim();
                    if (samityNameCell.toLowerCase().includes('officer total')) {
                        break;
                    }
                    
                    // This is the "fill-down" logic for merged cells
                    if (row[0] !== null && String(row[0]).trim() !== '') lastFieldWorkerId = String(row[0]).trim();
                    if (row[1] !== null && String(row[1]).trim() !== '') lastFieldWorkerName = String(row[1]).trim();
                    if (row[2] !== null && String(row[2]).trim() !== '') lastSamityId = String(row[2]).trim();
                    if (row[3] !== null && String(row[3]).trim() !== '') lastSamityName = String(row[3]).trim();
                    
                    // A row is considered a transaction if it has a component or any financial data
                    const hasFinancialData = row.slice(4).some(cell => cell !== null && cell !== '' && !isNaN(Number(cell)) && Number(cell) !== 0);
                    const hasComponent = row[4] !== null && String(row[4]).trim() !== '';

                    if (lastSamityId && (hasFinancialData || hasComponent)) {
                         const newTransaction: UploadedRow = {
                            'Field Worker ID': lastFieldWorkerId,
                            'Field Worker Name': lastFieldWorkerName,
                            'Samity ID': formatGroupCode(lastSamityId),
                            'Samity Name': lastSamityName,
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
                        allTransactions.push(newTransaction);
                    }
                }
                
                const userVisibleGroupCodes = new Set(userVisibleGroups?.map(g => String(g.code).trim().toLowerCase()) || []);

                const validData = allTransactions.filter(row => {
                    const normalizedSamityId = String(row['Samity ID']).trim().toLowerCase();
                    return userVisibleGroupCodes.has(normalizedSamityId);
                });

                if (allTransactions.length > 0 && validData.length === 0) {
                     toast({
                        variant: "destructive",
                        title: "No Matching Data",
                        description: `The file contains data, but none of the Samity IDs match your assigned groups.`,
                        duration: 9000,
                    });
                    return;
                }

                if (validData.length === 0) {
                    toast({ 
                        variant: "destructive", 
                        title: "No Valid Data", 
                        description: "No processable data found in the file." 
                    });
                    return;
                }
                
                setUploadedData(validData);
                setWizardStep(0);
                setIsConfirmDialogOpen(true);

            } catch (error) {
                console.error("Error parsing Excel file:", error);
                toast({ variant: "destructive", title: "Error Reading File", description: "There was a problem processing the file. Please ensure it matches the downloaded template structure." });
            }
        };
        reader.readAsArrayBuffer(excelFile);
    }
    
    const processPdf = (pdfFile: File) => {
        setIsParsing(true);
        const reader = new FileReader();
        reader.readAsDataURL(pdfFile);
        reader.onload = async () => {
            try {
                const pdfDataUri = reader.result as string;
                toast({ title: 'AI Parsing Started', description: 'Please wait while the AI processes your PDF file. This may take a moment.' });
                const parsedData = await parseTransactions({ pdfDataUri });

                if (!parsedData || parsedData.length === 0) {
                    toast({ variant: 'destructive', title: 'PDF Parsing Failed', description: 'The AI could not extract any valid data from the PDF. Please check the file format or try the Excel template.' });
                    setIsParsing(false);
                    return;
                }
                
                const formattedData = parsedData.map(row => ({...row, 'Samity ID': formatGroupCode(row['Samity ID'])}));
                
                const userVisibleGroupCodes = new Set(userVisibleGroups?.map(g => String(g.code).trim().toLowerCase()) || []);
                const validData = formattedData.filter(row => userVisibleGroupCodes.has(String(row['Samity ID']).trim().toLowerCase()));

                if (formattedData.length > 0 && validData.length === 0) {
                     toast({
                        variant: "destructive",
                        title: "No Matching Data in PDF",
                        description: "The AI extracted data, but none of it matches your assigned groups.",
                        duration: 7000,
                    });
                    setIsParsing(false);
                    return;
                }
                
                setUploadedData(validData);
                setWizardStep(0);
                setIsConfirmDialogOpen(true);

            } catch (error) {
                console.error("PDF Parsing error:", error);
                toast({ variant: "destructive", title: "PDF Parsing Error", description: "An unexpected error occurred while parsing the PDF." });
            } finally {
                setIsParsing(false);
            }
        };
        reader.onerror = () => {
            setIsParsing(false);
            toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected PDF file.' });
        };
    };

    const handleProcessUpload = () => {
        if (!file) {
            toast({ variant: "destructive", title: "No file selected", description: "Please select a file to upload." });
            return;
        }
        if (isLoading) {
            toast({ title: "Please wait", description: "Groups are still loading. Try again in a moment." });
            return;
        }
        
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (fileExtension === 'pdf') {
            processPdf(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            processExcel(file);
        } else {
            toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload an Excel (.xlsx, .xls) or PDF file.' });
        }
    };

    const handleConfirmUpload = () => {
        if (!uploadDate) {
            toast({ variant: 'destructive', title: 'Date Required', description: 'Please select a date for the transactions.' });
            return;
        }
        if (!groupsData || !branchesData) {
            toast({ variant: 'destructive', title: 'Data Loading', description: 'Group or branch data is not yet available. Please wait and try again.' });
            return;
        }

        const groupMap = new Map(groupsData.map(g => [String(g.code).trim().toLowerCase(), g]));
        const branchMap = new Map(branchesData.map(b => [b.id, b]));
        const othersEntriesToAdd: Omit<OtherDataEntry, 'id'>[] = [];

        uploadedData.forEach(row => {
            const normalizedSamityId = String(row['Samity ID']).trim().toLowerCase();
            const group = groupMap.get(normalizedSamityId);
            if (!group) return;

            const branch = branchMap.get(group.branchId);
            if (!branch) return;

            const notes = `Raw data upload for ${group.name}`;

            // Savings
            if (row['Savings Collection'] > 0 || row['Savings Refund'] > 0) {
                addSavingsTransaction({
                    date: uploadDate,
                    groupId: group.id,
                    deposit: row['Savings Collection'],
                    withdraw: row['Savings Refund'],
                    notes
                });
            }
            
            // Loan Disbursement
            if (row['Disbursement Amount'] > 0) {
                addLoanDisbursement({
                    date: uploadDate,
                    groupId: group.id,
                    amount: row['Disbursement Amount'],
                    notes
                });
            }
            
            // Loan Collection
            if (row['Loan Collection Total'] > 0) {
                addLoanCollection({
                    date: uploadDate,
                    groupId: group.id,
                    amount: row['Loan Collection Total'],
                    notes: `Regular: ${row['Loan Collection Regular']}, Due: ${row['Loan Collection Due']}, Advance: ${row['Loan Collection Advance']}`
                });
            }

            // Member Additions from Admission Fees
            const admissionFeesAmount = row['Admission fees'];
            if (admissionFeesAmount > 0) {
                const membersAdded = admissionFeesAmount / 10;
                if (membersAdded > 0) {
                     addMemberChange({
                        date: uploadDate,
                        groupId: group.id,
                        added: membersAdded,
                        dropped: 0,
                        notes: `From raw data upload.`
                    });
                }
            }
            
            // Others Data
            const otherDataMapping: { [key: string]: OtherDataEntry['type'] } = {
                'Risk fund': 'Risk Fund',
                'Processing Fees / Form fees': 'Processing Fee',
                'Passbook fees': 'Passbook Fee',
                'Admission fees': 'Admission Fee'
            };

            for (const [key, type] of Object.entries(otherDataMapping)) {
                const amount = row[key as keyof UploadedRow] as number;
                if (amount > 0) {
                    othersEntriesToAdd.push({
                        date: uploadDate,
                        branch: branch.name,
                        type: type,
                        amount: amount,
                        notes
                    });
                }
            }
        });
        
        if (othersEntriesToAdd.length > 0) {
            addBulkOthersData(othersEntriesToAdd);
        }

        toast({ title: "Upload Confirmed", description: `${uploadedData.length} transaction rows processed successfully.` });
        
        setIsConfirmDialogOpen(false);
        setUploadedData([]);
        setFile(null);
        setWizardStep(0);
        const fileInput = document.getElementById('raw-data-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const isLoading = groupsLoading || branchesLoading || employeesLoading;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Raw Data Entry</h1>
                <p className="text-muted-foreground">Upload your completed daily transaction report to process all transactions at once.</p>
            </div>

            <Card>
                 <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="flex flex-col justify-between space-y-4 rounded-lg border bg-background p-6">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Upload Report</h3>
                                <p className="text-sm text-muted-foreground mt-1">Select the completed Excel or PDF file from your computer.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="raw-data-upload" className="sr-only">Upload File</Label>
                                <Input id="raw-data-upload" type="file" accept=".xlsx, .xls, .pdf" onChange={handleFileChange} className="file:text-foreground" />
                            </div>
                        </div>
                        <div className="flex flex-col justify-between space-y-4 rounded-lg border bg-muted/20 p-6">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2"><Download className="h-5 w-5" />Need a Template?</h3>
                                <p className="text-sm text-muted-foreground mt-1">Download our pre-formatted Excel sheet to ensure a smooth upload.</p>
                            </div>
                            <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full">
                                Download Daily Transaction Template
                            </Button>
                        </div>
                    </div>
                    <div className="mt-6">
                        <Button onClick={handleProcessUpload} className="w-full" size="lg" disabled={!file || isLoading || isParsing}>
                            <Upload className="mr-2 h-5 w-5" />
                            {isParsing ? 'AI is Parsing PDF...' : isLoading ? 'Loading Data...' : 'Upload and Preview Transactions'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <ConfirmationWizard
                isOpen={isConfirmDialogOpen}
                onOpenChange={setIsConfirmDialogOpen}
                wizardStep={wizardStep}
                setWizardStep={setWizardStep}
                uploadedData={uploadedData}
                uploadDate={uploadDate}
                setUploadDate={setUploadDate}
                handleConfirmUpload={handleConfirmUpload}
                groupsData={groupsData}
                employeesData={employeesData}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Excel Template Format</CardTitle>
                    <CardDescription>
                        Your Excel file must follow this structure. Use the download button to get a blank template.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                             <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Field Worker</TableHead>
                                    <TableHead colSpan={2} className="text-center font-bold text-foreground border-r">Samity</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Component</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Savings Collection</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Interest On Savings</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Savings Refund</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Additional Fees Collection</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Disbursement Amount</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Regular Recovarable</TableHead>
                                    <TableHead colSpan={7} className="text-center font-bold text-foreground border-r">Loan Collection</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Risk fund</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Processing Fees / Form fees</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Passbook fees</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground border-r">Admission fees</TableHead>
                                    <TableHead rowSpan={3} className="align-middle text-center font-bold text-foreground">Total Collection</TableHead>
                                </TableRow>
                                <TableRow className="bg-muted/50">
                                    <TableHead rowSpan={2} className="align-middle font-bold text-foreground border-r">ID</TableHead>
                                    <TableHead rowSpan={2} className="align-middle font-bold text-foreground border-r">Name</TableHead>
                                    <TableHead rowSpan={2} className="align-middle font-bold text-foreground border-r">ID</TableHead>
                                    <TableHead rowSpan={2} className="align-middle font-bold text-foreground border-r">Name</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Regular</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Due</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Advance</TableHead>
                                    <TableHead rowSpan={2} className="align-middle text-center font-bold text-foreground border-r">Rebate</TableHead>
                                    <TableHead colSpan={3} className="text-center font-bold text-foreground border-r">Total Collection</TableHead>
                                </TableRow>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
                                    <TableHead className="font-bold text-foreground border-r">RS</TableHead>
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
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const WizardStepper = ({ currentStep }: { currentStep: number }) => {
    const steps = [
        { name: 'Savings', icon: Wallet },
        { name: 'Loans & OTR', icon: Landmark },
        { name: 'Fees & Admissions', icon: Users },
        { name: 'Officer Summary', icon: UserCheck },
    ];
    return (
        <div className="flex items-center justify-between w-full my-4 px-4 md:px-8">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isCurrent = currentStep === stepNumber;

                return (
                    <React.Fragment key={step.name}>
                        <div className="flex flex-col items-center text-center">
                            <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-2",
                                isCompleted ? "bg-primary border-primary text-primary-foreground" :
                                isCurrent ? "border-primary text-primary" :
                                "border-border text-muted-foreground"
                            )}>
                                {isCompleted ? <CheckCircle className="w-6 h-6" /> : <step.icon className="w-5 h-5" />}
                            </div>
                            <p className={cn("mt-2 text-xs font-semibold", isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground")}>{step.name}</p>
                        </div>
                        {index < steps.length - 1 && (
                             <div className={cn("flex-1 h-0.5 mx-2", isCompleted ? 'bg-primary' : 'bg-border')} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const Step0RawDataPreview = ({ data }: { data: UploadedRow[] }) => {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Data to Preview</CardTitle>
                    <CardDescription>The uploaded file did not contain any valid data rows.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const columns = Object.keys(data[0]) as (keyof UploadedRow)[];

    // Group rows by Samity ID
    const groupedData = data.reduce((acc, row) => {
        const key = row['Samity ID'];
        if (!acc[key]) {
            acc[key] = { ...row, 'Component': [row.Component] };
             Object.keys(row).forEach(colKey => {
                const typedKey = colKey as keyof UploadedRow;
                if (typeof row[typedKey] === 'number') {
                    acc[key][typedKey] = row[typedKey];
                }
            });
        } else {
            acc[key].Component.push(row.Component);
            Object.keys(row).forEach(colKey => {
                 const typedKey = colKey as keyof UploadedRow;
                if (typeof row[typedKey] === 'number' && typedKey !== 'Samity ID') {
                    (acc[key][typedKey] as number) += row[typedKey];
                }
            });
        }
        return acc;
    }, {} as Record<string, UploadedRow & { Component: string[] }>);


    const aggregatedRows = Object.values(groupedData).map(group => ({
        ...group,
        'Component': group.Component.join(', ')
    }));


    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Aggregated Data Preview</CardTitle>
                <CardDescription>Transactions have been grouped by Samity. Review the totals before proceeding.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <Table className="min-w-[3000px]">
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {aggregatedRows.map((row, index) => (
                                <TableRow key={index}>
                                    {columns.map(col => (
                                        <TableCell key={col} className="whitespace-nowrap">
                                            {typeof row[col] === 'number' && col !== 'Samity ID' ? formatCurrency(row[col] as number) : String(row[col])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


// Step 1: Savings
const Step1Savings = ({ data }: { data: UploadedRow[] }) => {
    const totals = useMemo(() => {
        return data.reduce((acc, row) => {
            acc.collection += row['Savings Collection'];
            acc.interest += row['Interest On Savings'];
            acc.refund += row['Savings Refund'];
            return acc;
        }, { collection: 0, interest: 0, refund: 0 });
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 1: Savings Summary</CardTitle>
                <CardDescription>Confirm the total savings collections and refunds from the uploaded file.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Savings Collection</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{formatCurrency(totals.collection)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Interest On Savings</CardDescription>
                        <CardTitle className="text-3xl">{formatCurrency(totals.interest)}</CardTitle>
                    </CardHeader>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Savings Refund</CardDescription>
                        <CardTitle className="text-3xl text-red-600">{formatCurrency(totals.refund)}</CardTitle>
                    </CardHeader>
                </Card>
            </CardContent>
        </Card>
    );
};


// Step 2: Loans & OTR
const Step2Loans = ({ data }: { data: UploadedRow[] }) => {
    const totals = useMemo(() => {
        const initial = {
            recoverable: 0,
            totalCollection: 0,
            advance: 0,
            principle: 0,
            serviceCharge: 0
        };
        const aggregated = data.reduce((acc, row) => {
            acc.recoverable += row['Regular Recovarable'];
            acc.totalCollection += row['Loan Collection Total'];
            acc.advance += row['Loan Collection Advance'];
            acc.principle += row['Loan Received (principle)'];
            acc.serviceCharge += row['Loan Received (Service Charge)'];
            return acc;
        }, initial);
        
        const totalReceived = aggregated.principle + aggregated.serviceCharge;
        const overallOtr = aggregated.recoverable > 0 ? ((totalReceived - aggregated.advance) / aggregated.recoverable) * 100 : 0;
        
        return { ...aggregated, overallOtr: Math.max(0, overallOtr) };
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 2: Loan Recovery Summary</CardTitle>
                <CardDescription>Confirm the total loan collections and overall On-Time Recovery (OTR) percentage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardDescription>Overall On-Time Recovery (OTR)</CardDescription>
                                <CardTitle className={cn("text-4xl", totals.overallOtr >= 95 ? "text-green-600" : totals.overallOtr >= 85 ? "text-orange-500" : "text-red-600")}>
                                    {totals.overallOtr.toFixed(2)}%
                                </CardTitle>
                            </div>
                            <Progress value={totals.overallOtr} className="w-1/3 h-4" />
                        </div>
                    </CardHeader>
                 </Card>
                 <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Regular Recoverable</CardDescription>
                            <CardTitle className="text-2xl">{formatCurrency(totals.recoverable)}</CardTitle>
                        </CardHeader>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Loan Collected</CardDescription>
                            <CardTitle className="text-2xl text-green-600">{formatCurrency(totals.totalCollection)}</CardTitle>
                        </CardHeader>
                    </Card>
                 </div>
                 <div className="grid gap-4 md:grid-cols-3">
                     <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Principle Received</CardDescription>
                            <CardTitle className="text-xl">{formatCurrency(totals.principle)}</CardTitle>
                        </CardHeader>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Service Charge Received</CardDescription>
                            <CardTitle className="text-xl">{formatCurrency(totals.serviceCharge)}</CardTitle>
                        </CardHeader>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Advance Collection</CardDescription>
                            <CardTitle className="text-xl text-blue-600">{formatCurrency(totals.advance)}</CardTitle>
                        </CardHeader>
                    </Card>
                 </div>
            </CardContent>
        </Card>
    );
};

// Step 3: Other Collections & Admissions
const Step3Others = ({ data }: { data: UploadedRow[] }) => {
    const totals = useMemo(() => {
        return data.reduce((acc, row) => {
            acc.admission += row['Admission fees'];
            acc.members += Math.floor(row['Admission fees'] / 10);
            acc.passbook += row['Passbook fees'];
            acc.processing += row['Processing Fees / Form fees'];
            acc.risk += row['Risk fund'];
            return acc;
        }, { admission: 0, members: 0, passbook: 0, processing: 0, risk: 0 });
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 3: Fees & Member Admissions Summary</CardTitle>
                <CardDescription>Confirm total other fee collections and the total number of new members to be admitted.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Members Admitted</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{totals.members}</CardTitle>
                    </CardHeader>
                     <CardContent>
                        <p className="text-sm text-muted-foreground">From {formatCurrency(totals.admission)} in Admission Fees</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Passbook Fees</CardDescription>
                        <CardTitle className="text-3xl">{formatCurrency(totals.passbook)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                     <CardHeader className="pb-2">
                        <CardDescription>Total Processing Fees</CardDescription>
                        <CardTitle className="text-3xl">{formatCurrency(totals.processing)}</CardTitle>
                    </CardHeader>
                </Card>
                 <Card>
                     <CardHeader className="pb-2">
                        <CardDescription>Total Risk Fund</CardDescription>
                        <CardTitle className="text-3xl">{formatCurrency(totals.risk)}</CardTitle>
                    </CardHeader>
                </Card>
            </CardContent>
        </Card>
    );
};


// Step 4: Summary
const Step4Summary = ({ data, groupsData, employeesData }: { data: UploadedRow[], groupsData: Group[] | null, employeesData: Employee[] | null }) => {
    const summaryData = useMemo(() => {
        if (!groupsData || !employeesData) return [];

        const groupMap = new Map(groupsData.filter(g => g.code).map(g => [String(g.code).toLowerCase(), g]));
        const employeeMap = new Map(employeesData.map(e => [e.id, e]));
        const officerMap = new Map<string, { name: string, total: number }>();

        data.forEach(row => {
            const samityCode = String(row['Samity ID']).toLowerCase();
            const group = groupMap.get(samityCode);

            if (group && group.responsibleEmployeeId) {
                const employee = employeeMap.get(group.responsibleEmployeeId);
                if (employee) {
                    if (!officerMap.has(employee.id)) {
                        officerMap.set(employee.id, { name: employee.name, total: 0 });
                    }
                    const current = officerMap.get(employee.id)!;
                    current.total += row['Total Collection'];
                    officerMap.set(employee.id, current);
                }
            }
        });
        return Array.from(officerMap.values());
    }, [data, groupsData, employeesData]);
    
    const grandTotal = useMemo(() => summaryData.reduce((acc, officer) => acc + officer.total, 0), [summaryData]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 4: Field Officer Summary</CardTitle>
                <CardDescription>Final review of total collections per field officer, based on group assignments.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-[45vh] relative">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead>Field Officer Name</TableHead>
                                <TableHead className="text-right">Total Collection</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.map((officer, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{officer.name}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(officer.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter className="sticky bottom-0 bg-background z-10">
                            <TableRow className="font-bold text-lg">
                                <TableCell>Grand Total</TableCell>
                                <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

const ConfirmationWizard = ({ isOpen, onOpenChange, wizardStep, setWizardStep, uploadedData, uploadDate, setUploadDate, handleConfirmUpload, groupsData, employeesData }: any) => {
    
     const handleClose = (open: boolean) => {
        if (!open) {
            onOpenChange(false);
            setTimeout(() => setWizardStep(0), 300); // Reset step after dialog closes
        } else {
            onOpenChange(true);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Confirm Raw Data Upload</DialogTitle>
                    <DialogDescription>
                        {wizardStep === 0
                            ? "Review the raw data extracted from your file. Click 'Proceed to Summary' to continue."
                            : "Review the transactions in a step-by-step process before saving."}
                    </DialogDescription>
                </DialogHeader>

                 {wizardStep > 0 && (
                    <>
                        <div className="space-y-2 max-w-sm">
                            <Label htmlFor="upload-date">Date for All Transactions</Label>
                            <Input id="upload-date" type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
                        </div>
                        <WizardStepper currentStep={wizardStep} />
                    </>
                )}
                
                <div className="flex-grow overflow-hidden relative">
                    {wizardStep === 0 && <Step0RawDataPreview data={uploadedData} />}
                    {wizardStep === 1 && <Step1Savings data={uploadedData} />}
                    {wizardStep === 2 && <Step2Loans data={uploadedData} />}
                    {wizardStep === 3 && <Step3Others data={uploadedData} />}
                    {wizardStep === 4 && <Step4Summary data={uploadedData} groupsData={groupsData} employeesData={employeesData} />}
                </div>

                <DialogFooter className="mt-auto pt-4 border-t !justify-between">
                     <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                    <div className="flex gap-2">
                        {wizardStep > 0 && (
                            <Button variant="secondary" onClick={() => setWizardStep((s: number) => s - 1)}>
                                Previous
                            </Button>
                        )}
                        
                        {wizardStep === 0 && (
                            <Button onClick={() => setWizardStep(1)}>Proceed to Summary</Button>
                        )}
                        
                        {wizardStep > 0 && wizardStep < 4 && (
                            <Button onClick={() => setWizardStep((s: number) => s + 1)}>Next</Button>
                        )}

                        {wizardStep === 4 && (
                            <Button onClick={handleConfirmUpload} className="bg-green-600 hover:bg-green-700">
                                Confirm & Save All
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

    