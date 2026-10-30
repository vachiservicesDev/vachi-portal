import { z } from 'zod';
import { STATE_RULES } from './states/rules';

/**
 * Federal income tax withholding from a 2020-or-later Form W-4, using the IRS Publication 15-T
 * annual percentage method. The 2026 figures below come from IRS Rev. Proc. 2025-32 (standard
 * deduction and brackets). Check them against the current Publication 15-T each January.
 *
 * State withholding uses each state's own 2026 formula (states/rules.ts) with the answers from the
 * employee's state certificate; the nine states without a wage tax withhold nothing.
 */

export const TAX_YEAR = 2026;

export const FILING_STATUSES = {
  single: 'Single or married filing separately',
  married_jointly: 'Married filing jointly',
  head_of_household: 'Head of household',
} as const;
export type FilingStatus = keyof typeof FILING_STATUSES;

const STANDARD_DEDUCTION: Record<FilingStatus, number> = { single: 16_100, married_jointly: 32_200, head_of_household: 24_150 };

// [upper bound of taxable income, rate]
const BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [[12_400, 0.1], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24], [256_225, 0.32], [640_600, 0.35], [Infinity, 0.37]],
  married_jointly: [[24_800, 0.1], [100_800, 0.12], [211_400, 0.22], [403_550, 0.24], [512_450, 0.32], [768_700, 0.35], [Infinity, 0.37]],
  head_of_household: [[17_700, 0.1], [67_450, 0.12], [105_700, 0.22], [201_750, 0.24], [256_200, 0.32], [640_600, 0.35], [Infinity, 0.37]],
};

export const PAY_FREQUENCIES = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 } as const;
export type PayFrequency = keyof typeof PAY_FREQUENCIES;
export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
};

/** States without a tax on wages. */
export const NO_WAGE_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

const money = z.coerce.number().nonnegative('Can’t be negative.').max(10_000_000);

export const w4Schema = z.object({
  filingStatus: z.enum(['single', 'married_jointly', 'head_of_household']),
  multipleJobs: z.boolean().default(false), // Step 2(c)
  dependentsAmount: money.default(0), // Step 3
  otherIncome: money.default(0), // Step 4(a)
  deductions: money.default(0), // Step 4(b)
  extraWithholding: money.default(0), // Step 4(c), per pay period
  exempt: z.boolean().default(false),
});
export type W4 = z.infer<typeof w4Schema>;

const count = z.coerce.number().int('Use a whole number.').nonnegative('Can’t be negative.').max(99);

/**
 * The employee's state withholding certificate. `formula` (the default) applies the state's own
 * 2026 formula (see states/rules.ts) to these answers; `percent` and `amount` are overrides for
 * cases the formula doesn't cover, like an agreed flat amount.
 */
export const stateWithholdingSchema = z.object({
  mode: z.enum(['formula', 'percent', 'amount', 'none']).default('formula'),
  status: z.string().trim().max(20).optional(),
  allowances: count.optional(),
  dependents: count.optional(),
  amount: z.coerce.number().nonnegative('Can’t be negative.').max(100_000).optional(),
  locality: z.string().trim().max(40).optional(),
  exempt: z.boolean().default(false),
  value: z.coerce.number().nonnegative('Can’t be negative.').max(100_000).default(0),
  extra: z.coerce.number().nonnegative('Can’t be negative.').max(100_000).default(0),
});
export type StateWithholding = z.infer<typeof stateWithholdingSchema>;

/** What employees.w4 holds. */
export interface TaxSetup {
  federal?: W4 & { submittedAt?: string; submittedBy?: 'employee' | 'hr' };
  state?: StateWithholding;
}

const round = (n: number) => Math.round(n * 100) / 100;

function bracketTax(taxable: number, brackets: [number, number][]): number {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/**
 * Federal income tax to withhold this pay period. `wages` is the period's federal taxable wages
 * (gross pay less pre-tax deductions like 401(k) and health insurance).
 */
export function federalWithholding(wages: number, frequency: PayFrequency, w4: W4): number {
  if (w4.exempt || wages <= 0) return 0;
  const periods = PAY_FREQUENCIES[frequency];
  // Step 2(c) checked: the IRS halves the standard deduction and the bracket widths.
  const halve = w4.multipleJobs ? 0.5 : 1;
  const annual = wages * periods + w4.otherIncome - w4.deductions - STANDARD_DEDUCTION[w4.filingStatus] * halve;
  const brackets = BRACKETS[w4.filingStatus].map(([upper, rate]) => [upper * halve, rate] as [number, number]);
  const annualTax = Math.max(0, bracketTax(Math.max(0, annual), brackets) - w4.dependentsAmount);
  return round(annualTax / periods + w4.extraWithholding);
}

/** The state filing status to use when the employee hasn't chosen one: mapped from the federal W-4. */
export function defaultStateStatus(state: string, federal?: W4): string | undefined {
  const statuses = STATE_RULES[state]?.statuses;
  if (!statuses) return undefined;
  const fs = federal?.filingStatus;
  const want = fs === 'married_jointly' ? ['married', 'M', 'married_joint', 'C', 'B'] : fs === 'head_of_household' ? ['hoh', 'H', 'B', 'single', 'S'] : ['single', 'S', 'F', 'A', 'other', 'standard', 'one'];
  return want.find((k) => k in statuses) ?? Object.keys(statuses)[0];
}

export interface StateTaxInput {
  /** This period's wages after pre-tax deductions (the state taxable wages). */
  wages: number;
  /** Gross less section 125 only, for states that tax 401(k) deferrals (Pennsylvania). */
  wagesWith401k?: number;
  frequency: PayFrequency;
  /** Federal income tax withheld this period. */
  federalTax: number;
  ficaYtd?: number;
}

/**
 * State income tax to withhold this pay period. 0 in states without a wage tax; null when the state
 * isn't covered (HR enters the figure).
 */
export function stateWithholding(state: string | null | undefined, setup: TaxSetup, input: StateTaxInput): number | null {
  if (!state) return null;
  if (NO_WAGE_TAX_STATES.includes(state)) return 0;
  const s = setup.state ?? stateWithholdingSchema.parse({});
  if (s.mode === 'none') return null;
  if (s.exempt) return round(s.extra);
  if (s.mode === 'percent') return round((input.wages * s.value) / 100 + s.extra);
  if (s.mode === 'amount') return round(s.value + s.extra);
  const rule = STATE_RULES[state];
  if (!rule) return null;
  const periods = PAY_FREQUENCIES[input.frequency];
  const wages = state === 'PA' ? (input.wagesWith401k ?? input.wages) : input.wages;
  if (wages <= 0) return round(s.extra);
  const form = { ...s, status: s.status || defaultStateStatus(state, setup.federal) };
  const annual = rule.annualTax(wages * periods, form, {
    periods,
    federalAnnual: input.federalTax * periods,
    federal: setup.federal,
    periodWages: wages,
    ficaYtd: input.ficaYtd ?? 0,
  });
  let perPeriod = Math.max(0, annual) / periods;
  if (rule.roundPeriod === 'dollar') perPeriod = Math.round(perPeriod);
  else if (rule.roundPeriod === 'up') perPeriod = Math.ceil(perPeriod);
  return round(perPeriod + s.extra);
}

/** Pay frequency from the length of a pay period, when the employee has none set. */
export function frequencyFromPeriod(start: string, end: string): PayFrequency {
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
  if (days <= 8) return 'weekly';
  if (days <= 14) return 'biweekly';
  if (days <= 16) return 'semimonthly';
  return 'monthly';
}
