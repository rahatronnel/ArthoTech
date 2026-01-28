'use server';
/**
 * @fileOverview An AI flow to analyze an uploaded Excel file and extract structured financial data.
 *
 * - analyzeFile - A function that handles the file analysis process.
 * - AnalyzeFileInput - The input type for the analyzeFile function.
 * - AnalyzeFileOutput - The return type for the analyzeFile function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as XLSX from 'xlsx';
import {
    AnalyzeFileInputSchema,
    AnalyzeFileOutputSchema,
    type AnalyzeFileInput,
    type AnalyzeFileOutput
} from '@/ai/schemas';

// The main function that will be called from the client
export async function analyzeFile(input: AnalyzeFileInput): Promise<AnalyzeFileOutput> {
  return analyzeFileFlow(input);
}


// Define the Genkit prompt
const fileAnalysisPrompt = ai.definePrompt({
    name: 'fileAnalysisPrompt',
    input: { schema: z.object({ fileContent: z.string() }) },
    output: { schema: AnalyzeFileOutputSchema },
    prompt: `You are an expert financial data analyst for a microfinance company. Your task is to analyze the provided text content, which has been extracted from an Excel file, and identify all relevant transactions for each "Samity" (which means "Group").

The content contains daily transaction data. You must extract the following information and structure it into the specified JSON format.

**DATA EXTRACTION RULES:**

1.  **Member Changes**:
    - Find any new members added or existing members dropped for each group.

2.  **Savings Transactions**:
    - Calculate 'deposit' by summing the 'Savings Collection' and 'Interest On Savings' columns for each group.
    - The 'withdraw' amount comes from the 'Savings Refund' column.

3.  **Loan Transactions**:
    - The 'disbursement' amount comes from the 'Disbursement Amount' column.
    - Calculate 'collection' by summing the 'Loan Received principle' and 'service charge' columns for each group.

4.  **Fee Transactions**:
    - Extract the values for the following fee types for each group. These are separate from the main loan and savings transactions.
    - 'riskFund': From the 'Risk fund' column. Usually collected during loan disbursement.
    - 'processingFee': From the 'Procession Fees' or 'form fees' column. Usually charged during loan disbursement.
    - 'passbookFee': From the 'Passbook fees' column. Usually charged for new members.
    - 'admissionFee': From the 'Addmission fees' column. Usually charged for new members.

**OUTPUT STRUCTURE:**
- Your final output must be a single JSON object matching the provided output schema.
- Aggregate the data for each group.
- If a value is not present for a certain transaction type for a group, treat it as 0. Do not guess or invent data.
- Pay close attention to column headers like 'Field Worker', 'Samity', and 'Component' to correctly associate values.

Here is the file content:
---
{{{fileContent}}}
---
`,
});

// Define the Genkit flow
const analyzeFileFlow = ai.defineFlow(
  {
    name: 'analyzeFileFlow',
    inputSchema: AnalyzeFileInputSchema,
    outputSchema: AnalyzeFileOutputSchema,
  },
  async (input) => {
    // 1. Convert data URI to a Buffer
    const buffer = Buffer.from(
      input.fileDataUri.substring(input.fileDataUri.indexOf(',') + 1),
      'base64'
    );

    // 2. Parse the Excel buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 3. Convert sheet to a string format (e.g., CSV or just text) for the LLM
    // Using CSV is often a good balance of structure and simplicity for an LLM
    const fileContent = XLSX.utils.sheet_to_csv(worksheet);

    // 4. Call the AI model to analyze the content
    const { output } = await fileAnalysisPrompt({ fileContent });

    if (!output) {
      throw new Error("The AI model could not analyze the file.");
    }
    
    return output;
  }
);
