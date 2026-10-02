import { z } from 'zod';

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const money = z.coerce.number().nonnegative('Can’t be negative.').max(10_000_000);

export const WAGE_LEVELS = ['I', 'II', 'III', 'IV'] as const;

export const pafFields = z.object({
  lcaCaseNumber: z.string().trim().min(1, 'Enter the LCA case number.').max(100),
  lcaFilingDate: day('Enter the LCA filing date.'),
  worksite: z.string().trim().min(1, 'Enter the worksite address.').max(2000),
  wageLevel: z.enum(WAGE_LEVELS, { errorMap: () => ({ message: 'Choose level I to IV.' }) }).optional(),
  prevailingWage: money.optional(),
  actualWage: money.optional(),
  postingStartDate: day('Enter a valid date.').optional(),
  postingEndDate: day('Enter a valid date.').optional(),
});

type PafInput = z.infer<typeof pafFields>;

/** Rules that span fields: the H-1B wage floor and a sensible posting period. */
function crossFieldRules(v: PafInput, ctx: z.RefinementCtx) {
  if (v.prevailingWage !== undefined && v.actualWage !== undefined && v.actualWage < v.prevailingWage) {
    ctx.addIssue({ code: 'custom', path: ['actualWage'], message: 'The actual wage must be at least the prevailing wage.' });
  }
  if (v.postingStartDate && v.postingEndDate && v.postingEndDate < v.postingStartDate) {
    ctx.addIssue({ code: 'custom', path: ['postingEndDate'], message: 'The posting must end on or after it starts.' });
  }
}

export const createPafSchema = pafFields.extend({ employeeId: z.string().uuid('Choose an employee.') }).superRefine(crossFieldRules);
export const updatePafSchema = pafFields.superRefine(crossFieldRules);

/** Business days (Mon–Fri) from start to end, both included. The LCA notice must be up for 10. */
export function businessDays(start: string, end: string): number {
  let count = 0;
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (d <= last && count < 1000) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
