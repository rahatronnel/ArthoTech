"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { analyzeFile } from '@/ai/flows/analyze-file-flow';
import { type AnalyzeFileOutput } from '@/ai/schemas';
import { useMember } from '@/context/MemberContext';
import { useSavings } from '@/context/SavingsContext';
import { useLoan } from '@/context/LoanContext';
import { groups } from '@/lib/data';
import { Loader2 } from 'lucide-react';

export default function UploadDailyTransactionPage() {
    const { toast } = useToast();
    const { addMemberChange } = useMember();
    const { addSavingsTransaction } = useSavings();
    const { addLoanDisbursement, addLoanCollection } = useLoan();

    const [file, setFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeFileOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setAnalysisResult(null);
            setError(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'No file selected' });
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                const fileDataUri = event.target?.result as string;
                if (!fileDataUri) {
                    setError('Failed to read file.');
                    setIsLoading(false);
                    return;
                }
                try {
                    const result = await analyzeFile({ fileDataUri, fileName: file.name });
                    setAnalysisResult(result);
                    toast({ title: 'Analysis Complete', description: 'Review the extracted data below.' });
                } catch (err: any) {
                    setError(err.message || 'An error occurred during analysis.');
                    toast({ variant: 'destructive', title: 'Analysis Failed', description: err.message });
                } finally {
                    setIsLoading(false);
                }
            };
            reader.onerror = () => {
                setError('Failed to read file.');
                setIsLoading(false);
            };

        } catch (err: any) {
            // This catch block might not be strictly necessary with the one in reader.onload
            // but it's good for catching synchronous errors if any occur.
            setError(err.message || 'An unexpected error occurred.');
            toast({ variant: 'destructive', title: 'Error', description: err.message });
            setIsLoading(false);
        }
    };
    
    const findGroupIdByName = (name: string): string | undefined => {
        return groups.find(g => g.name.toLowerCase() === name.toLowerCase())?.id;
    };

    const handleSave = () => {
        if (!analysisResult) {
            toast({ variant: 'destructive', title: 'No data to save' });
            return;
        }
        if (!date) {
            toast({ variant: 'destructive', title: 'Please select a date' });
            return;
        }
        
        let savedCount = 0;

        // Save Member Changes
        analysisResult.memberChanges.forEach(mc => {
            const groupId = findGroupIdByName(mc.groupName);
            if (groupId && (mc.added > 0 || mc.dropped > 0)) {
                addMemberChange({ date, groupId, added: mc.added, dropped: mc.dropped, notes: 'AI Bulk Import' });
                savedCount++;
            }
        });
        
        // Save Savings Transactions
        analysisResult.savingsTransactions.forEach(st => {
            const groupId = findGroupIdByName(st.groupName);
            if(groupId && (st.deposit > 0 || st.withdraw > 0)) {
                addSavingsTransaction({ date, groupId, deposit: st.deposit, withdraw: st.withdraw, notes: 'AI Bulk Import' });
                savedCount++;
            }
        });

        // Save Loan Transactions
        analysisResult.loanTransactions.forEach(lt => {
            const groupId = findGroupIdByName(lt.groupName);
            if(groupId) {
                if (lt.disbursement > 0) {
                    addLoanDisbursement({ date, groupId, amount: lt.disbursement, notes: 'AI Bulk Import' });
                    savedCount++;
                }
                if (lt.collection > 0) {
                    addLoanCollection({ date, groupId, amount: lt.collection, notes: 'AI Bulk Import' });
                    savedCount++;
                }
            }
        });
        
        toast({ title: 'Save Successful', description: `Successfully saved ${savedCount} transaction records.` });
        setAnalysisResult(null);
        setFile(null);
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);


  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Upload Daily Transaction</h1>
        <p className="text-muted-foreground">Upload an Excel file to automatically extract and save daily transactions using AI.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Your File</CardTitle>
          <CardDescription>Select the daily transaction report from your other software.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="grid gap-2">
                <Label htmlFor="transaction-file">Excel File</Label>
                <Input id="transaction-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="file:text-foreground" />
             </div>
             <Button onClick={handleAnalyze} disabled={!file || isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Analyzing...' : 'Analyze File'}
             </Button>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysisResult && (
        <Card>
            <CardHeader>
                <CardTitle>2. Review Extracted Data</CardTitle>
                <CardDescription>Verify the data extracted by the AI. If it's correct, select a date and save it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2 sm:w-1/3">
                    <Label htmlFor="transaction-date">Transaction Date</Label>
                    <Input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                
                {analysisResult.memberChanges.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Member Changes</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead>Group Name</TableHead><TableHead className="text-right">Added</TableHead><TableHead className="text-right">Dropped</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {analysisResult.memberChanges.map((item, i) => (
                                    <TableRow key={`mc-${i}`}><TableCell>{item.groupName}</TableCell><TableCell className="text-right">{item.added}</TableCell><TableCell className="text-right">{item.dropped}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                
                {analysisResult.savingsTransactions.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold mb-2">Savings Transactions</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead>Group Name</TableHead><TableHead className="text-right">Deposited</TableHead><TableHead className="text-right">Withdrawn</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {analysisResult.savingsTransactions.map((item, i) => (
                                    <TableRow key={`st-${i}`}><TableCell>{item.groupName}</TableCell><TableCell className="text-right">{formatCurrency(item.deposit)}</TableCell><TableCell className="text-right">{formatCurrency(item.withdraw)}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {analysisResult.loanTransactions.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold mb-2">Loan Transactions</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead>Group Name</TableHead><TableHead className="text-right">Disbursed</TableHead><TableHead className="text-right">Collected</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {analysisResult.loanTransactions.map((item, i) => (
                                    <TableRow key={`lt-${i}`}><TableCell>{item.groupName}</TableCell><TableCell className="text-right">{formatCurrency(item.disbursement)}</TableCell><TableCell className="text-right">{formatCurrency(item.collection)}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                
                <Button onClick={handleSave} className="w-full" disabled={!date}>Save to Database</Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
