
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { UploadedRowSchema } from '@/ai/schemas';

const ParseTransactionsInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file containing financial transactions, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'"
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
  prompt: `You are an expert data entry specialist. Your task is to extract tabular data from a PDF file that looks like a complex Excel spreadsheet.

CRITICAL BUSINESS RULES (NON-NEGOTIABLE):
1.  **NEVER Aggregate Rows**: My system does its own aggregation. You MUST return one JSON object for every single transaction row you see in the table. If one 'Samity' (group) has two components ('GL' and 'ME'), you MUST return two separate JSON objects.
2.  **Handle Merged Cells**: The PDF will look like it has merged cells for 'Field Worker' and 'Samity'. This means the ID and Name might only appear on the first row of a group. For all subsequent rows that belong to that same group (where the ID/Name columns are blank), you MUST copy the ID and Name from the row above.
3.  **Filter by Component**: A row is only a valid transaction if the 'Component' column is not blank. You MUST ignore and skip any rows where the 'Component' column is empty, as these are sub-total or grand-total rows.
4.  **Ignore Headers and Footers**: Ignore the complex, multi-line header at the top. Also, ignore any summary rows at the bottom that you might have missed with the Component rule, especially those containing 'Officer Total'.

Your only job is to flatten the visual table into a clean array of JSON objects, with one object per transaction row that has a component.

Example:
If you see a Samity with two component rows like this:
- Samity ID: 1.0026, Component: GL, Savings Collection: 330
- (blank),       Component: ME, Savings Collection: 100
- (blank),       Component: (blank), Savings Collection: 430 (This is a sub-total row)
You MUST return two JSON objects and ignore the third:
- One for GL with all its data.
- One for ME with all its data, ensuring you copy the Samity ID and Name from the row above.

Now, process the following PDF: {{media url=pdfDataUri}}`,
});

const parseTransactionsFlow = ai.defineFlow(
  {
    name: 'parseTransactionsFlow',
    inputSchema: ParseTransactionsInputSchema,
    outputSchema: ParseTransactionsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'gemini-1.5-pro' });
    if (!output) {
      throw new Error('Failed to parse data from PDF.');
    }
    return output;
  }
);

    