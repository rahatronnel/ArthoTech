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

// Define the structure for individual transaction types
const MemberChangeSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    added: z.number().describe('The number of members added.'),
    dropped: z.number().describe('The number of members dropped.'),
});

const SavingsTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    deposit: z.number().describe('The amount of savings deposited.'),
    withdraw: z.number().describe('The amount of savings withdrawn.'),
});

const LoanTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    disbursement: z.number().describe('The amount of loan disbursed.'),
    collection: z.number().describe('The amount of loan collected.'),
});

// Define the overall output structure from the AI analysis
const AnalyzeFileOutputSchema = z.object({
    memberChanges: z.array(MemberChangeSchema).describe('List of all member changes found in the document.'),
    savingsTransactions: z.array(SavingsTransactionSchema).describe('List of all savings transactions found in the document.'),
    loanTransactions: z.array(LoanTransactionSchema).describe('List of all loan transactions found in the document.'),
});
export type AnalyzeFileOutput = z.infer<typeof AnalyzeFileOutputSchema>;

// Define the input schema for the flow
const AnalyzeFileInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The full content of an Excel file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
   fileName: z.string().describe('The name of the uploaded file.')
});
export type AnalyzeFileInput = z.infer<typeof AnalyzeFileInputSchema>;


// The main function that will be called from the client
export async function analyzeFile(input: AnalyzeFileInput): Promise<AnalyzeFileOutput> {
  return analyzeFileFlow(input);
}


// Define the Genkit prompt
const fileAnalysisPrompt = ai.definePrompt({
    name: 'fileAnalysisPrompt',
    input: { schema: z.object({ fileContent: z.string() }) },
    output: { schema: AnalyzeFileOutputSchema },
    prompt: `You are an expert financial data analyst for a microfinance company. Your task is to analyze the provided text content, which has been extracted from an Excel file, and identify all relevant transactions.

The content contains daily transaction data for various groups. You must extract the following information:
1.  **Member Changes**: Look for any mention of new members being added or existing members being dropped from a group.
2.  **Savings Transactions**: Identify all savings deposits and withdrawals for each group.
3.  **Loan Transactions**: Find all loan disbursements (money given out) and loan collections (repayments received).

RULES:
- Carefully read through the entire text to find all data.
- Aggregate the data for each group. For example, if a group has multiple savings deposits, sum them up.
- Pay close attention to column headers and row data to correctly associate values with groups and transaction types.
- If a value is not present for a certain transaction type for a group, treat it as 0. Do not guess or invent data.
- Structure your final output as a single JSON object matching the provided schema, with arrays for memberChanges, savingsTransactions, and loanTransactions.

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
