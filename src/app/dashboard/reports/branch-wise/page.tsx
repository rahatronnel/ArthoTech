"use client";

import { branches } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, ChevronLeft } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import Image from 'next/image';
import Link from 'next/link';

export default function BranchWiseReportPage() {
    const { orgInfo } = useOrganization();

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="print:p-8">
            <div className="flex items-center gap-4 mb-6 print:hidden">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/reports">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Back to Reports</span>
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Branch Wise Basic Report</h1>
            </div>

            <Card id="print-area">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Branch Report</CardTitle>
                        <CardDescription>A summary of all branches within the organization.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 print:hidden" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                        Print Report
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="hidden print:block text-center mb-8">
                         {orgInfo.logo && <Image src={orgInfo.logo} alt={orgInfo.name} width={120} height={50} className="mx-auto object-contain" />}
                        <h1 className="text-2xl font-bold mt-2">{orgInfo.name}</h1>
                        <p className="text-sm text-muted-foreground">{orgInfo.bengaliName}</p>
                        <p className="text-xs text-muted-foreground">{orgInfo.address}</p>
                        <h2 className="text-xl font-semibold mt-6 underline decoration-double">Branch Wise Basic Report</h2>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch Name</TableHead>
                                <TableHead>Bengali Name</TableHead>
                                <TableHead>Branch Code</TableHead>
                                <TableHead>Area</TableHead>
                                <TableHead>Zone</TableHead>
                                <TableHead>Region</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {branches.map((branch) => (
                                <TableRow key={branch.id}>
                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                    <TableCell>{branch.bengaliName}</TableCell>
                                    <TableCell>{branch.code}</TableCell>
                                    <TableCell>{branch.area}</TableCell>
                                    <TableCell>{branch.zone}</TableCell>
                                    <TableCell>{branch.region}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
