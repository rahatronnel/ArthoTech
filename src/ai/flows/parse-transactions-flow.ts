
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { UploadedRowSchema } from '@/ai/schemas';

const ParseTransactionsInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file containing financial transactions, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
});

const ParseTransactionsOutputSchema = z.array(UploadedRowSchema);

export async function parseTransactions(input: z.infer<typeof ParseTransactionsInputSchema>): Promise<z.infer<typeof ParseTransactionsOutputSchema>> {
  return parseTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseTransactionsPrompt',
  input: { schema: ParseTransactionsInputSchema },
  output: { schema: ParseTransactionsOutputSchema, },
  prompt: `You are an expert data entry specialist. Your task is to extract and aggregate tabular data from a PDF file.
  The PDF contains daily transaction data for a microfinance organization.
  The table has a complex, multi-row header. You should ignore the header and only extract the data rows.
  Data rows contain information about a 'Samity' (a group).

  IMPORTANT AGGREGATION LOGIC:
  A single 'Samity' may have multiple rows if it has different 'Component' values (e.g., 'gl', 'Me'). You MUST aggregate these multiple rows into a SINGLE JSON object for that 'Samity'.
  - Sum all numeric columns for that 'Samity'.
  - For the 'Component' column, combine the unique component names into a single comma-separated string (e.g., "gl, Me").
  - The 'Samity Name', 'Field Worker ID', and 'Field Worker Name' should be the same across these rows; use the first one you encounter for the aggregated object.

  Some rows might not have a 'Field Worker ID' and 'Field Worker Name'. In these cases, you must use the values from the last row that had them.
  Some rows are summary rows for an officer, often containing 'Officer Total' in the first column. You must ignore these rows.

  Extract all valid data, aggregate it by 'Samity ID', and return a JSON array where each object represents one unique 'Samity'.
  
  PDF with transaction data: {{media url=pdfDataUri}}`,
  config: {
    model: 'gemini-1.5-pro-latest'
  }
});

const parseTransactionsFlow = ai.defineFlow(
  {
    name: 'parseTransactionsFlow',
    inputSchema: ParseTransactionsInputSchema,
    outputSchema: ParseTransactionsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to parse data from PDF.');
    }
    return output;
  }
);
