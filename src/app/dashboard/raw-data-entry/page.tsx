"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const columns: string[] = [
    'Field Worker (ID and Name)',
    'Samity (ID and name)',
    'Component',
    'Savings Collection',
    'Savings Refund',
    'Interest On Savings',
    'Disbursement Amount',
    'Regular Recovarable',
    'Loan Received principle',
    'service charge',
    'Risk fund',
    'Processing Fees / Form fees',
    'Passbook fees',
    'Admission fees',
    'Total Collection',
];

const exampleRow = [
    'E001 - Alice Johnson',
    'G001 - Sunrise Group',
    'General Loan',
    '500',
    '0',
    '10',
    '10000',
    '1000',
    '450',
    '50',
    '100',
    '200',
    '20',
    '100',
    '1220',
];


export default function RawDataEntryPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Raw Data Entry Template</h1>
                <p className="text-muted-foreground">This page shows the required format for your daily transaction Excel file.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Excel Template Preview</CardTitle>
                    <CardDescription>
                        Your Excel file must have the following columns in this exact order. Below is an example of what one row of data would look like.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                {columns.map((colName) => (
                                    <TableHead key={colName} className="font-bold text-foreground">{colName}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                {exampleRow.map((cellData, index) => (
                                    <TableCell key={index}>{cellData}</TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    ... your data continues here ...
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
