'use server';
/**
 * @fileOverview An AI flow for analyzing file content.
 *
 * - analyzeFile - A function that takes file content and returns an analysis.
 * - AnalyzeFileInput - The input type for the analyzeFile function.
 * - AnalyzeFileOutput - The return type for the analyzeFile function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeFileInputSchema = z.object({
  fileContent: z.string().describe('The text content of the file to be analyzed.'),
});
export type AnalyzeFileInput = z.infer<typeof AnalyzeFileInputSchema>;

const AnalyzeFileOutputSchema = z.object({
  analysis: z.string().describe('A summary and analysis of the provided file content.'),
});
export type AnalyzeFileOutput = z.infer<typeof AnalyzeFileOutputSchema>;

export async function analyzeFile(input: AnalyzeFileInput): Promise<AnalyzeFileOutput> {
  return analyzeFileFlow(input);
}

const analyzeFilePrompt = ai.definePrompt({
    name: 'analyzeFilePrompt',
    input: { schema: AnalyzeFileInputSchema },
    output: { schema: AnalyzeFileOutputSchema },
    prompt: `You are an expert data analyst. Your task is to analyze the following file content and provide a concise summary.

Identify the type of file if possible (e.g., CSV, JSON, plain text).
Summarize the key information, patterns, or insights found in the data.
If it's tabular data, describe the columns and a few sample rows.
If it's structured data like JSON, describe the overall structure.

File Content:
---
{{{fileContent}}}
---

Provide your analysis below.`,
});

const analyzeFileFlow = ai.defineFlow(
    {
        name: 'analyzeFileFlow',
        inputSchema: AnalyzeFileInputSchema,
        outputSchema: AnalyzeFileOutputSchema,
    },
    async (input) => {
        const { output } = await analyzeFilePrompt(input);
        if (!output) {
            throw new Error("The analysis model did not return a valid output.");
        }
        return output;
    }
);
