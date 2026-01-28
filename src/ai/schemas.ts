import { z } from 'zod';

// Define the structure for individual transaction types
export const MemberChangeSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    added: z.number().describe('The number of members added.'),
    dropped: z.number().describe('The number of members dropped.'),
});

export const SavingsTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    deposit: z.number().describe('The amount of savings deposited.'),
    withdraw: z.number().describe('The amount of savings withdrawn.'),
});

export const LoanTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group.'),
    disbursement: z.number().describe('The amount of loan disbursed.'),
    collection: z.number().describe('The amount of loan collected.'),
});

// Define the overall output structure from the AI analysis
export const AnalyzeFileOutputSchema = z.object({
    memberChanges: z.array(MemberChangeSchema).describe('List of all member changes found in the document.'),
    savingsTransactions: z.array(SavingsTransactionSchema).describe('List of all savings transactions found in the document.'),
    loanTransactions: z.array(LoanTransactionSchema).describe('List of all loan transactions found in the document.'),
});
export type AnalyzeFileOutput = z.infer<typeof AnalyzeFileOutputSchema>;

// Define the input schema for the flow
export const AnalyzeFileInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The full content of an Excel file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
   fileName: z.string().describe('The name of the uploaded file.')
});
export type AnalyzeFileInput = z.infer<typeof AnalyzeFileInputSchema>;
