import { z } from 'zod';
import { stateWithholdingSchema, w4Schema, type TaxSetup } from './w4';

const money = (max: number) => z.coerce.number().nonnegative('Can’t be negative.').max(max);

/** HR's pay setup for one employee. Federal and state forms can also come from the employee. */
export const paySetupSchema = z
  .object({
    payType: z.enum(['hourly', 'salary'], { errorMap: () => ({ message: 'Choose hourly or salary.' }) }),
    payRate: money(100_000).optional().nullable(),
    annualSalary: money(100_000_000).optional().nullable(),
    payFrequency: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly'], { errorMap: () => ({ message: 'Choose how often they are paid.' }) }),
    workState: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use the two-letter state code, like TX.'),
    federal: w4Schema.optional(),
    state: stateWithholdingSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payType === 'hourly' && !v.payRate) ctx.addIssue({ code: 'custom', path: ['payRate'], message: 'Enter the hourly rate.' });
    if (v.payType === 'salary' && !v.annualSalary) ctx.addIssue({ code: 'custom', path: ['annualSalary'], message: 'Enter the yearly salary.' });
  });

/**
 * What an employee fills in themselves: their federal W-4 and state withholding form, signed by
 * typing their name under the W-4's penalties-of-perjury statement.
 */
export const employeeFormsSchema = z.object({
  federal: w4Schema,
  state: stateWithholdingSchema.optional(),
  ssnLast4: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of your Social Security number.'),
  signedName: z.string().trim().min(2, 'Type your full name to sign.').max(120),
  perjury: z.literal(true, { errorMap: () => ({ message: 'Confirm the statement to sign the W-4.' }) }),
});

export function taxSetupOf(stored: unknown): TaxSetup {
  return (stored && typeof stored === 'object' ? stored : {}) as TaxSetup;
}
