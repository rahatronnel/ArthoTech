import { z } from 'zod';

// Define the structure for individual transaction types
export const MemberChangeSchema = z.object({
    groupName: z.string().describe('The name of the group (Samity).'),
    added: z.number().describe('The number of members added.'),
    dropped: z.number().describe('The number of members dropped.'),
});

export const SavingsTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group (Samity).'),
    deposit: z.number().describe("The total amount of savings deposited. This should be the sum of 'Savings Collection' and 'Interest On Savings'."),
    withdraw: z.number().describe("The amount of savings withdrawn, from the 'Savings Refund' column."),
});

export const LoanTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group (Samity).'),
    disbursement: z.number().describe("The amount of loan disbursed, from the 'Disbursement Amount' column."),
    collection: z.number().describe("The total amount of loan collected. This should be the sum of 'Loan Received principle' and 'service charge'."),
});

export const FeeTransactionSchema = z.object({
    groupName: z.string().describe('The name of the group (Samity).'),
    riskFund: z.number().describe("The amount collected for the 'Risk fund' insurance."),
    processingFee: z.number().describe("The amount collected for 'Procession Fees' or 'form fees'."),
    passbookFee: z.number().describe("The amount collected for 'Passbook fees'."),
    admissionFee: z.number().describe("The amount collected for 'Addmission fees'."),
});


// Define the overall output structure from the AI analysis
export const AnalyzeFileOutputSchema = z.object({
    memberChanges: z.array(MemberChangeSchema).describe('List of all member changes found in the document.'),
    savingsTransactions: z.array(SavingsTransactionSchema).describe('List of all savings transactions found in the document.'),
    loanTransactions: z.array(LoanTransactionSchema).describe('List of all loan transactions found in the document.'),
    feeTransactions: z.array(FeeTransactionSchema).describe('List of all other fee-based transactions found in the document.'),
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
