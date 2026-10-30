import type { W4 } from "../w4";

/** What an employee puts on their state withholding certificate. Each state uses a subset. */
export interface StateForm {
  /** State filing status, from the rule's `statuses`. */
  status?: string;
  /** Allowances or exemptions, as the state's form counts them. */
  allowances?: number;
  /** A second count some forms have (dependents, additional allowances for deductions). */
  dependents?: number;
  /** A dollar amount some forms have (credits, deductions), or AZ's elected percent. */
  amount?: number;
  /** County or city, for states that withhold local tax with the state's (Maryland). */
  locality?: string;
  /** Extra withholding per pay period. */
  extra?: number;
  exempt?: boolean;
}

export interface StateContext {
  /** Pay periods in a year. */
  periods: number;
  /** Federal income tax withheld this period, annualized. Some states subtract it. */
  federalAnnual: number;
  /** The employee's federal W-4, for states that fall back to it. */
  federal?: W4;
  /** This period's state taxable wages. */
  periodWages: number;
  /** Social Security wages paid earlier this year (Massachusetts deducts FICA up to a cap). */
  ficaYtd: number;
}

export type StateField = "status" | "allowances" | "dependents" | "amount";

export interface StateRule {
  name: string;
  /** The state's withholding certificate. */
  form: string;
  statuses?: Record<string, string>;
  /** Form fields this state uses, with their labels. */
  fields: Partial<Record<Exclude<StateField, "status">, string>>;
  /** County or city rates, when the state's form asks for one. */
  localities?: Record<string, number>;
  /** Some states round each period's withholding to whole dollars. */
  roundPeriod?: "dollar" | "up";
  /** Annual tax to withhold on annualized wages (after pre-tax deductions). */
  annualTax: (
    annualWages: number,
    form: StateForm,
    ctx: StateContext,
  ) => number;
  /** Where the formula comes from. Check it each January. */
  source: string;
}

/** Progressive tax from [over, rate] rows sorted ascending. */
export function graduated(income: number, rows: [number, number][]): number {
  let tax = 0;
  for (let i = 0; i < rows.length; i++) {
    const [over, rate] = rows[i];
    if (income <= over) break;
    const upper = i + 1 < rows.length ? rows[i + 1][0] : Infinity;
    tax += (Math.min(income, upper) - over) * rate;
  }
  return tax;
}

/** Tax from [over, rate, plus] rows as states print them: plus + (income − over) × rate. */
export function table(
  income: number,
  rows: [number, number, number][],
): number {
  let row = rows[0];
  for (const r of rows) if (income > r[0]) row = r;
  return income > row[0] ? row[2] + (income - row[0]) * row[1] : 0;
}

export const n = (x: number | undefined) => (x && x > 0 ? x : 0);
