import { z } from 'zod';
import { FILING_STATUSES, type FilingStatus } from './w4';

/**
 * An itemized, industry-standard earnings statement: earnings as hours × rate, every tax withheld,
 * pre- and post-tax deductions, net pay, and year-to-date totals for each line. The admin form
 * fills the figures from the employee's pay setup, timesheets and W-4 (see taxes.ts), HR can
 * override any of them, and the server adds them up so gross and net always match their lines.
 *
 * Stored in pay_stubs.deductions (jsonb), which was reserved for this breakdown.
 */

/** Used until HR saves the company details under Admin → Company details. */
export const DEFAULT_COMPANY = { name: 'Vachi Services LLC', address: '', ein: '', phone: '' };
export type Company = typeof DEFAULT_COMPANY;

/** 2026 Social Security wage base and the FICA rates. */
export const SOCIAL_SECURITY_RATE = 0.062;
export const SOCIAL_SECURITY_WAGE_BASE = 184_500;
export const MEDICARE_RATE = 0.0145;

export type EarningCode = 'regular' | 'overtime' | 'bonus' | 'other';
export type TaxCode = 'federal' | 'social_security' | 'medicare' | 'state' | 'local';

export interface EarningLine {
  code: EarningCode;
  label: string;
  hours?: number;
  rate?: number;
  amount: number;
}
export interface TaxLine {
  code: TaxCode;
  label: string;
  amount: number;
}
export interface DeductionLine {
  label: string;
  amount: number;
  preTax: boolean;
}
export interface StubDetail {
  version: 1;
  earnings: EarningLine[];
  taxes: TaxLine[];
  deductions: DeductionLine[];
  paymentMethod: 'direct_deposit' | 'check';
  /** Shown like ADP's "Taxable marital status"; the withholding itself still comes from HR. */
  filingStatus?: FilingStatus;
  /** The work state at pay time, kept even when nothing was withheld, so W-2s and reports don't move wages after a relocation. */
  stateCode?: string;
  /** Last four digits of the deposit account, for the deposit advice. Never the full number. */
  depositLast4?: string;
}

export { FILING_STATUSES };

const amount = (label: string) => z.coerce.number().nonnegative(`${label} can’t be negative.`).max(10_000_000).optional();
const hours = z.coerce.number().nonnegative('Hours can’t be negative.').max(744, 'That is more hours than a month has.').optional();
const rate = z.coerce.number().nonnegative('The rate can’t be negative.').max(100_000).optional();
const label = z.string().trim().max(60).optional();

export const stubInputSchema = z
  .object({
    employeeId: z.string().uuid('Choose an employee.'),
    regularHours: hours,
    regularRate: rate,
    overtimeHours: hours,
    overtimeRate: rate,
    salary: amount('Salary'),
    bonus: amount('Bonus'),
    otherEarnings: amount('Other earnings'),
    otherEarningsLabel: label,
    federalTax: amount('Federal income tax'),
    socialSecurity: amount('Social Security'),
    medicare: amount('Medicare'),
    stateTax: amount('State income tax'),
    stateCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use the two-letter state code, like TX.').optional().or(z.literal('').transform(() => undefined)),
    localTax: amount('Local tax'),
    retirement: amount('401(k)'),
    healthInsurance: amount('Health insurance'),
    otherDeduction: amount('Other deduction'),
    otherDeductionLabel: label,
    paymentMethod: z.enum(['direct_deposit', 'check']).default('direct_deposit'),
    filingStatus: z.enum(['single', 'married_jointly', 'head_of_household']).optional().or(z.literal('').transform(() => undefined)),
    depositLast4: z.string().trim().regex(/^\d{4}$/, 'Enter just the last 4 digits.').optional().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if ((v.regularHours ?? 0) > 0 && v.regularRate === undefined) {
      ctx.addIssue({ code: 'custom', path: ['regularRate'], message: 'Enter the hourly rate.' });
    }
    if ((v.overtimeHours ?? 0) > 0 && v.overtimeRate === undefined) {
      ctx.addIssue({ code: 'custom', path: ['overtimeRate'], message: 'Enter the overtime rate.' });
    }
  });

export type StubInput = z.infer<typeof stubInputSchema>;

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (lines: { amount: number }[]) => cents(lines.reduce((s, l) => s + l.amount, 0));

/** Turns HR's figures into stored lines plus the gross and net they add up to. */
export function buildStub(input: StubInput): { detail: StubDetail; grossPay: number; netPay: number; error?: { field: string; message: string } } {
  const earnings: EarningLine[] = [];
  if (input.salary) earnings.push({ code: 'regular', label: 'Salary', amount: cents(input.salary) });
  if (input.regularHours && input.regularRate !== undefined) {
    earnings.push({ code: 'regular', label: 'Regular', hours: input.regularHours, rate: input.regularRate, amount: cents(input.regularHours * input.regularRate) });
  }
  if (input.overtimeHours && input.overtimeRate !== undefined) {
    earnings.push({ code: 'overtime', label: 'Overtime', hours: input.overtimeHours, rate: input.overtimeRate, amount: cents(input.overtimeHours * input.overtimeRate) });
  }
  if (input.bonus) earnings.push({ code: 'bonus', label: 'Bonus', amount: cents(input.bonus) });
  if (input.otherEarnings) earnings.push({ code: 'other', label: input.otherEarningsLabel || 'Other earnings', amount: cents(input.otherEarnings) });

  const taxes: TaxLine[] = [
    { code: 'federal' as const, label: 'Federal income tax', amount: input.federalTax ?? 0 },
    { code: 'social_security' as const, label: 'Social Security', amount: input.socialSecurity ?? 0 },
    { code: 'medicare' as const, label: 'Medicare', amount: input.medicare ?? 0 },
    { code: 'state' as const, label: input.stateCode ? `${input.stateCode} state income tax` : 'State income tax', amount: input.stateTax ?? 0 },
    { code: 'local' as const, label: 'Local tax', amount: input.localTax ?? 0 },
  ]
    .filter((t) => t.amount > 0 || t.code === 'federal' || t.code === 'social_security' || t.code === 'medicare')
    .map((t) => ({ ...t, amount: cents(t.amount) }));

  const deductions: DeductionLine[] = [];
  if (input.retirement) deductions.push({ label: '401(k)', amount: cents(input.retirement), preTax: true });
  if (input.healthInsurance) deductions.push({ label: 'Health insurance', amount: cents(input.healthInsurance), preTax: true });
  if (input.otherDeduction) deductions.push({ label: input.otherDeductionLabel || 'Other deduction', amount: cents(input.otherDeduction), preTax: false });

  const grossPay = sum(earnings);
  const netPay = cents(grossPay - sum(taxes) - sum(deductions));
  const detail: StubDetail = {
    version: 1,
    earnings,
    taxes,
    deductions,
    paymentMethod: input.paymentMethod,
    ...(input.filingStatus && { filingStatus: input.filingStatus }),
    ...(input.stateCode && { stateCode: input.stateCode }),
    ...(input.paymentMethod === 'direct_deposit' && input.depositLast4 && { depositLast4: input.depositLast4 }),
  };

  if (earnings.length === 0) return { detail, grossPay, netPay, error: { field: 'regularHours', message: 'Enter hours and a rate, a salary, or another earning.' } };
  if (netPay < 0) return { detail, grossPay, netPay, error: { field: 'federalTax', message: 'Taxes and deductions add up to more than gross pay.' } };
  return { detail, grossPay, netPay };
}

/** Stubs saved before itemizing only have gross and net; show them as one earning and one total. */
export function detailOf(stored: unknown, grossPay: number, netPay: number): StubDetail {
  const d = stored as Partial<StubDetail> | null;
  if (d && d.version === 1) return d as StubDetail;
  const withheld = cents(grossPay - netPay);
  return {
    version: 1,
    earnings: [{ code: 'regular', label: 'Gross pay', amount: grossPay }],
    taxes: [],
    deductions: withheld > 0 ? [{ label: 'Taxes and deductions', amount: withheld, preTax: false }] : [],
    paymentMethod: 'direct_deposit',
  };
}

export interface StatementLine {
  label: string;
  hours?: number;
  rate?: number;
  current: number;
  ytd: number;
  preTax?: boolean;
}

export interface Statement {
  earnings: StatementLine[];
  taxes: StatementLine[];
  deductions: StatementLine[];
  totals: { gross: [number, number]; taxes: [number, number]; deductions: [number, number]; net: [number, number] };
  paymentMethod: StubDetail['paymentMethod'];
  filingStatus?: FilingStatus;
  depositLast4?: string;
}

/**
 * Lines with current and year-to-date amounts. `history` is every processed stub for the same
 * employee in the same calendar year up to and including this one (by pay date). Lines that only
 * appear earlier in the year still show, with 0 for this period, as on a standard statement.
 */
export function buildStatement(current: StubDetail, history: StubDetail[]): Statement {
  const group = <T extends { label: string; amount: number }>(pick: (d: StubDetail) => T[], extra: (l: T) => Partial<StatementLine>) => {
    const order: string[] = [];
    const rows = new Map<string, StatementLine>();
    const add = (l: T, isCurrent: boolean) => {
      if (!rows.has(l.label)) {
        order.push(l.label);
        rows.set(l.label, { label: l.label, current: 0, ytd: 0 });
      }
      const row = rows.get(l.label)!;
      row.ytd = cents(row.ytd + l.amount);
      if (isCurrent) Object.assign(row, extra(l), { current: cents(row.current + l.amount) });
    };
    pick(current).forEach((l) => add(l, true));
    history.forEach((d) => pick(d).forEach((l) => add(l, false)));
    return order.map((k) => rows.get(k)!);
  };

  const all = [current, ...history];
  const earnings = group((d) => d.earnings, (l) => ({ hours: l.hours, rate: l.rate }));
  const taxes = group((d) => d.taxes, () => ({}));
  const deductions = group((d) => d.deductions, (l) => ({ preTax: l.preTax }));
  const pair = (f: (d: StubDetail) => number): [number, number] => [cents(f(current)), cents(all.reduce((s, d) => s + f(d), 0))];
  const gross = pair((d) => sum(d.earnings));
  const tax = pair((d) => sum(d.taxes));
  const ded = pair((d) => sum(d.deductions));
  return {
    earnings,
    taxes,
    deductions,
    totals: { gross, taxes: tax, deductions: ded, net: [cents(gross[0] - tax[0] - ded[0]), cents(gross[1] - tax[1] - ded[1])] },
    paymentMethod: current.paymentMethod,
    filingStatus: current.filingStatus,
    depositLast4: current.depositLast4,
  };
}
