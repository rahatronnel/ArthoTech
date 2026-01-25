"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSavings } from '@/context/SavingsContext';
import { groups } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isBefore } from 'date-fns';
import { Upload } from 'lucide-react';

type ReportRow = {
  groupId: string;
  groupName: string;
  openingBalance: number;
  depositedToday: number;
  withdrawnToday: number;
  closingBalance: number;
};

export default function SavingsBalancePage() {
  const { toast } = useToast();
  const { savingsTransactions, addSavingsTransaction } = useSavings();
  
  // State for the entry form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [withdraw, setWithdraw] = useState(0);
  const [notes, setNotes] = useState('');

  // State for bulk upload
  const [file, setFile] = useState<File | null>(null);

  // State for the report
  const [searchDate, setSearchDate] = useState('');
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleAddTransaction = () => {
    if (!date || !groupId || (deposit === 0 && withdraw === 0)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill out date, group, and at least one transaction (deposit/withdraw).",
      });
      return;
    }
    addSavingsTransaction({ date, groupId, deposit, withdraw, notes });
    toast({
      title: "Transaction Recorded",
      description: `Savings transaction for ${groups.find(g => g.id === groupId)?.name} on ${date} has been saved.`
    });
    // Reset form
    setGroupId('');
    setDeposit(0);
    setWithdraw(0);
    setNotes('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select an Excel file to upload.",
      });
      return;
    }
    // Placeholder for Excel processing logic
    toast({
      title: "File Uploaded",
      description: `${file.name} is being processed. This is a placeholder; file parsing is not yet implemented.`,
    });
    setFile(null);
    const fileInput = document.getElementById('bulk-upload-savings') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  };


  const handleSearch = () => {
    if (!searchDate) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please select a date to generate the report.",
        });
        return;
    }
    const targetDate = parseISO(searchDate);

    const report = groups.map(group => {
        const openingBalance = group.initialSavings + savingsTransactions
            .filter(t => t.groupId === group.id && isBefore(parseISO(t.date), targetDate))
            .reduce((acc, t) => acc + t.deposit - t.withdraw, 0);

        const todaysTransactions = savingsTransactions.filter(t => t.groupId === group.id && t.date === searchDate);
        
        const depositedToday = todaysTransactions.reduce((sum, t) => sum + t.deposit, 0);
        const withdrawnToday = todaysTransactions.reduce((sum, t) => sum + t.withdraw, 0);
        
        const closingBalance = openingBalance + depositedToday - withdrawnToday;

        return {
            groupId: group.id,
            groupName: group.name,
            openingBalance,
            depositedToday,
            withdrawnToday,
            closingBalance,
        };
    });
    setReportData(report);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Savings Balance Management</h1>
        <p className="text-muted-foreground">Record savings transactions and view daily balance reports.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Savings Transaction</CardTitle>
            <CardDescription>Record deposits and withdrawals for a group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-date">Date</Label>
              <Input id="change-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select onValueChange={setGroupId} value={groupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit</Label>
                <Input id="deposit" type="number" min="0" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw">Withdrawal</Label>
                <Input id="withdraw" type="number" min="0" value={withdraw} onChange={(e) => setWithdraw(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."/>
            </div>
            <Button onClick={handleAddTransaction} className="w-full">Save Transaction</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Savings Transactions</CardTitle>
            <CardDescription>Upload an Excel file to add multiple transactions at once.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-upload-savings">Excel File</Label>
              <Input id="bulk-upload-savings" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">
                The file should have columns: GroupID, Date (YYYY-MM-DD), Deposit, Withdraw, Notes (optional).
              </p>
            </div>
            <Button onClick={handleBulkUpload} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Savings Balance Report</CardTitle>
          <CardDescription>Select a date to see the savings balance for each group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-grow">
              <Label htmlFor="search-date">Report Date</Label>
              <Input id="search-date" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
            <Button onClick={handleSearch} className="w-full sm:w-auto">Search</Button>
          </div>
          
          <div className="mt-6">
              {reportData ? (
                   <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Group</TableHead>
                              <TableHead className="text-right">Opening Balance</TableHead>
                              <TableHead className="text-right">Deposited</TableHead>
                              <TableHead className="text-right">Withdrawn</TableHead>
                              <TableHead className="text-right">Closing Balance</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {reportData.map(row => (
                              <TableRow key={row.groupId}>
                                  <TableCell className="font-medium">{row.groupName}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(row.openingBalance)}</TableCell>
                                  <TableCell className="text-right text-green-600">+{formatCurrency(row.depositedToday)}</TableCell>
                                  <TableCell className="text-right text-red-600">-{formatCurrency(row.withdrawnToday)}</TableCell>
                                  <TableCell className="text-right font-bold">{formatCurrency(row.closingBalance)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              ) : (
                  <div className="text-center py-10 text-muted-foreground">
                      <p>Please select a date and click "Search" to view the report.</p>
                  </div>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
