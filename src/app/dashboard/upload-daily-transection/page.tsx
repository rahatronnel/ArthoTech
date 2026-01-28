"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function UploadDailyTransactionPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Upload Daily Transaction</h1>
                <p className="text-muted-foreground">This feature has been disabled as requested.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        AI Feature Disabled
                    </CardTitle>
                </CardHeader>
                <CardContent>
                   <CardDescription>
                        The AI-powered Excel import feature has been removed. You can continue to use the manual and bulk-upload features on the individual data entry pages:
                        <ul className="list-disc pl-6 mt-4 space-y-1">
                            <li>Members</li>
                            <li>Savings Balance</li>
                            <li>Loan Disbursement</li>
                            <li>Loan Collection</li>
                        </ul>
                   </CardDescription>
                </CardContent>
            </Card>
        </div>
    );
}
