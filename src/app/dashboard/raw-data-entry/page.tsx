"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download } from 'lucide-react';

export default function RawDataEntryPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleDownloadTemplate = () => {
        toast({ title: "Not implemented", description: "Template download is not yet configured." });
    };

    const handleProcessUpload = () => {
        if (!file) {
            toast({ variant: "destructive", title: "No file selected" });
            return;
        }
        toast({ title: "File selected", description: `You have selected ${file.name}. The next steps are not yet configured.` });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Raw Data Entry</h1>
                <p className="text-muted-foreground">Upload raw data from your Excel files for processing.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bulk Data Upload</CardTitle>
                    <CardDescription>Download a template, fill it with your raw data, and upload it here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <div className="space-y-2">
                        <Label htmlFor="bulk-upload-raw">Upload Filled Template</Label>
                        <Input id="bulk-upload-raw" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="file:text-foreground" />
                    </div>
                    <Button onClick={handleProcessUpload} className="w-full" disabled={!file}>
                        <Upload className="mr-2 h-4 w-4" /> Upload and Process
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
