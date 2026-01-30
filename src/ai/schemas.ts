import { z } from 'zod';

export const UploadedRowSchema = z.object({
  'Field Worker ID': z.string().describe("The ID of the field worker for this row. If this is blank in a row, use the ID from the last row that had one."),
  'Field Worker Name': z.string().describe("The name of the field worker. If blank, use the name from the last row that had one."),
  'Samity ID': z.string().describe("The ID for the Samity (group)."),
  'Samity Name': z.string().describe("The name of the Samity (group)."),
  'Component': z.string().optional().describe("The component, if any."),
  'Savings Collection': z.number().default(0),
  'Interest On Savings': z.number().default(0),
  'Savings Refund': z.number().default(0),
  'Additional Fees Collection': z.number().default(0),
  'Disbursement Amount': z.number().default(0),
  'Regular Recovarable': z.number().default(0),
  'Loan Collection Regular': z.number().default(0),
  'Loan Collection Due': z.number().default(0),
  'Loan Collection Advance': z.number().default(0),
  'Loan Collection Rebate': z.number().default(0),
  'Loan Received (principle)': z.number().default(0),
  'Loan Received (Service Charge)': z.number().default(0),
  'Loan Collection Total': z.number().default(0),
  'Risk fund': z.number().default(0),
  'Processing Fees / Form fees': z.number().default(0),
  'Passbook fees': z.number().default(0),
  'Admission fees': z.number().default(0),
  'Total Collection': z.number().default(0),
});

export type UploadedRow = z.infer<typeof UploadedRowSchema>;
