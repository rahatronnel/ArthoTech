"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const columns = [
    { name: 'Field Worker (ID and Name)', description: 'The ID and Name of the employee responsible for the group. This maps to the employee data in the system.' },
    { name: 'Samity (ID and name)', description: 'The ID and Name of the group (Samity). This maps to the group data.' },
    { name: 'Component', description: 'The name of the loan product or component.' },
    { name: 'Savings Collection', description: 'Represents the savings deposit amount from a member.' },
    { name: 'Savings Refund', description: 'Represents the savings withdrawal amount by a member.' },
    { name: 'Interest On Savings', description: 'The profit or interest paid out to the member on their savings.' },
    { name: 'Disbursement Amount', description: 'The total loan amount disbursed to a group.' },
    { name: 'Regular Recovarable', description: 'The amount that is scheduled to be recovered on that particular day.' },
    { name: 'Loan Received principle', description: 'The principal portion of the loan installment collected.' },
    { name: 'Service charge', description: 'The service charge or interest portion of the loan installment collected. The sum of this and "Loan Received principle" will be the total loan collection.' },
    { name: 'Risk fund', description: 'Insurance fee collected from the member, typically at the time of loan disbursement.' },
    { name: 'Processing Fees / Form fees', description: 'Fees charged to the member for processing the loan.' },
    { name: 'Passbook fees', description: 'A one-time fee charged to a new member for their passbook.' },
    { name: 'Admission fees', description: 'A one-time fee charged when a new member joins.' },
    { name: 'Total Collection', description: 'The total amount of money collected from a group on a given day.' },
];

export default function RawDataEntryPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Raw Data Entry Template</h1>
                <p className="text-muted-foreground">This page outlines the column structure for your raw data Excel file.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Excel Template Format</CardTitle>
                    <CardDescription>Please ensure your Excel file follows this structure. The column names must match exactly.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/4">Column Name</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {columns.map((col, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{col.name}</TableCell>
                                    <TableCell>{col.description}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
