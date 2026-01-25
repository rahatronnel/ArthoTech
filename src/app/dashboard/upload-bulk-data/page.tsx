"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2 } from 'lucide-react';
import { analyzeFile, type AnalyzeFileOutput } from '@/ai/flows/analyze-file-flow';
import { Textarea } from '@/components/ui/textarea';

export default function UploadBulkDataPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeFileOutput | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setAnalysisResult(null); // Reset previous analysis
        }
    };

    const handleAnalyzeClick = async () => {
        if (!file) {
            toast({
                variant: 'destructive',
                title: 'No file selected',
                description: 'Please select a file to analyze.',
            });
            return;
        }

        setIsLoading(true);
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const fileContent = e.target?.result as string;
                if (!fileContent) {
                    throw new Error("Could not read file content.");
                }
                const result = await analyzeFile({ fileContent });
                setAnalysisResult(result);
                toast({
                    title: "Analysis Complete",
                    description: "The file has been successfully analyzed.",
                });
            } catch (error) {
                console.error('Analysis failed:', error);
                const errorMessage = error instanceof Error ? error.message : "Something went wrong.";
                toast({
                    variant: 'destructive',
                    title: 'Analysis Failed',
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            toast({
                variant: 'destructive',
                title: 'File Read Error',
                description: 'Could not read the selected file.',
            });
            setIsLoading(false);
        }

        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload and Analyze File</CardTitle>
                    <CardDescription>Upload a text-based file (like .txt, .csv, .json) to get an AI-powered analysis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Choose a file</Label>
                        <Input id="file-upload" type="file" onChange={handleFileChange} className="file:text-foreground"/>
                    </div>
                    <Button onClick={handleAnalyzeClick} disabled={isLoading || !file}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="mr-2 h-4 w-4" />
                                Analyze File
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Analysis in Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center py-12">
                         <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </CardContent>
                </Card>
            )}

            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            readOnly
                            value={analysisResult.analysis}
                            className="min-h-[200px] bg-muted"
                            rows={10}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
