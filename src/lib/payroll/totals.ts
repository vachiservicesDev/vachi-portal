import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { MEDICARE_RATE, SOCIAL_SECURITY_RATE, SOCIAL_SECURITY_WAGE_BASE, detailOf, type StubDetail } from './stub';
import type { TaxSetup } from './w4';

/**
 * Year-end W-2s and the monthly, quarterly and yearly payroll registers, built from processed pay
 * stubs by pay date (the date wages count for Forms 941, 940 and W-2).
 *
 * Wage bases follow the stub's lines: 401(k) deferrals reduce income-tax wages only, health
 * insurance (a section 125 plan) reduces income-tax and FICA wages. Pennsylvania taxes 401(k)
 * deferrals, so its state wages keep them.
 */

const cents = (n: number) => Math.round(n * 100) / 100;
const FUTA_RATE = 0.006;
const FUTA_WAGE_BASE = 7_000;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLD = 200_000;
/** States whose income tax doesn't exclude 401(k) deferrals. */
const STATES_TAXING_401K = new Set(['PA']);

export interface StubFigures {
  gross: number;
  retirement: number;
  health: number;
  otherDeductions: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  local: number;
  net: number;
  stateCode: string | null;
}

/** The figures on one stub, sorted into the buckets W-2s and tax returns need. */
export function figuresOf(d: StubDetail, fallbackState: string | null): StubFigures {
  const tax = (code: string) => cents(d.taxes.filter((t) => t.code === code).reduce((s, t) => s + t.amount, 0));
  const ded = (match: (l: StubDetail['deductions'][number]) => boolean) => cents(d.deductions.filter(match).reduce((s, l) => s + l.amount, 0));
  const gross = cents(d.earnings.reduce((s, l) => s + l.amount, 0));
  const retirement = ded((l) => l.preTax && /401/.test(l.label));
  const health = ded((l) => l.preTax && !/401/.test(l.label));
  const otherDeductions = ded((l) => !l.preTax);
  const stateLine = d.taxes.find((t) => t.code === 'state');
  const stateCode = d.stateCode ?? stateLine?.label.match(/^([A-Z]{2}) /)?.[1] ?? fallbackState;
  const f = {
    federal: tax('federal'),
    socialSecurity: tax('social_security'),
    medicare: tax('medicare'),
    state: tax('state'),
    local: tax('local'),
  };
  const net = cents(gross - f.federal - f.socialSecurity - f.medicare - f.state - f.local - retirement - health - otherDeductions);
  return { gross, retirement, health, otherDeductions, ...f, net, stateCode };
}

export interface PaidStub {
  stubId: string;
  payDate: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  workState: string | null;
  figures: StubFigures;
}

/** Every processed stub paid between two dates (inclusive), oldest first. */
export async function paidStubs(from: string, to: string, employeeId?: string): Promise<PaidStub[]> {
  const rows = await db
    .select({
      stub: payStubs,
      payDate: payRuns.payDate,
      employee: {
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        workState: employees.workState,
      },
    })
    .from(payStubs)
    .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
    .innerJoin(employees, eq(employees.id, payStubs.employeeId))
    .where(and(eq(payRuns.status, 'processed'), gte(payRuns.payDate, from), lte(payRuns.payDate, to), employeeId ? eq(payStubs.employeeId, employeeId) : undefined))
    .orderBy(asc(payRuns.payDate), asc(employees.lastName), asc(employees.firstName));
  return rows.map((r) => ({
    stubId: r.stub.id,
    payDate: r.payDate,
    employeeId: r.employee.id,
    firstName: r.employee.firstName,
    lastName: r.employee.lastName,
    workState: r.employee.workState,
    figures: figuresOf(detailOf(r.stub.deductions, Number(r.stub.grossPay), Number(r.stub.netPay)), r.employee.workState),
  }));
}

// ---------------------------------------------------------------- W-2

export interface W2 {
  year: number;
  box1: number; // wages, tips, other compensation
  box2: number; // federal income tax withheld
  box3: number; // social security wages
  box4: number; // social security tax withheld
  box5: number; // medicare wages and tips
  box6: number; // medicare tax withheld
  box12: { code: string; amount: number }[];
  states: { code: string; wages: number; tax: number }[]; // boxes 15-17
  localWages: number; // box 18: income-tax wages on stubs that withheld local tax
  local: number; // box 19
  stubs: number;
}

/** A W-2 from one employee's processed stubs for the year. */
export function buildW2(year: number, figures: StubFigures[]): W2 {
  const total = (k: keyof Omit<StubFigures, 'stateCode'>) => cents(figures.reduce((s, f) => s + f[k], 0));
  const gross = total('gross');
  const retirement = total('retirement');
  const health = total('health');
  const states = new Map<string, { code: string; wages: number; tax: number }>();
  for (const f of figures) {
    if (!f.stateCode) continue;
    const row = states.get(f.stateCode) ?? {
      code: f.stateCode,
      wages: 0,
      tax: 0,
    };
    row.wages = cents(row.wages + f.gross - f.health - (STATES_TAXING_401K.has(f.stateCode) ? 0 : f.retirement));
    row.tax = cents(row.tax + f.state);
    states.set(f.stateCode, row);
  }
  return {
    year,
    box1: cents(gross - retirement - health),
    box2: total('federal'),
    box3: Math.min(cents(gross - health), SOCIAL_SECURITY_WAGE_BASE),
    box4: total('socialSecurity'),
    box5: cents(gross - health),
    box6: total('medicare'),
    box12: retirement > 0 ? [{ code: 'D', amount: retirement }] : [],
    states: [...states.values()].filter((s) => s.wages > 0 || s.tax > 0),
    localWages: cents(figures.filter((f) => f.local > 0).reduce((s, f) => s + f.gross - f.retirement - f.health, 0)),
    local: total('local'),
    stubs: figures.length,
  };
}

export function ssnMasked(setup: TaxSetup | null | undefined) {
  return setup?.ssnLast4 ? `XXX-XX-${setup.ssnLast4}` : 'XXX-XX-____';
}

// ---------------------------------------------------------------- Payroll register

export type Period = {
  kind: 'month' | 'quarter' | 'year';
  year: number;
  index: number;
};

/** First and last day, and a label, for a month (1-12), quarter (1-4) or year. */
export function periodRange(p: Period): {
  from: string;
  to: string;
  label: string;
} {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (m: number) => new Date(Date.UTC(p.year, m, 0)).getUTCDate();
  if (p.kind === 'year')
    return {
      from: `${p.year}-01-01`,
      to: `${p.year}-12-31`,
      label: String(p.year),
    };
  if (p.kind === 'quarter') {
    const m1 = (p.index - 1) * 3 + 1;
    return {
      from: `${p.year}-${pad(m1)}-01`,
      to: `${p.year}-${pad(m1 + 2)}-${lastDay(m1 + 2)}`,
      label: `Q${p.index} ${p.year}`,
    };
  }
  const name = new Date(Date.UTC(p.year, p.index - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return {
    from: `${p.year}-${pad(p.index)}-01`,
    to: `${p.year}-${pad(p.index)}-${lastDay(p.index)}`,
    label: `${name} ${p.year}`,
  };
}

export interface RegisterRow {
  employeeId: string;
  name: string;
  stubs: number;
  gross: number;
  retirement: number;
  health: number;
  otherDeductions: number;
  federalWages: number;
  socialSecurityWages: number;
  medicareWages: number;
  futaWages: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  local: number;
  net: number;
}

const NUMERIC_KEYS = [
  'gross',
  'retirement',
  'health',
  'otherDeductions',
  'federalWages',
  'socialSecurityWages',
  'medicareWages',
  'futaWages',
  'federal',
  'socialSecurity',
  'medicare',
  'state',
  'local',
  'net',
] as const;

export interface Register {
  period: Period & { from: string; to: string; label: string };
  employees: RegisterRow[];
  totals: Omit<RegisterRow, 'employeeId' | 'name'>;
  states: { code: string; wages: number; tax: number }[];
  months: { month: string; liability: number }[];
  /** What the business owes on top of what it withheld, and the Form 941 figures. */
  employer: {
    socialSecurity: number;
    medicare: number;
    futa: number;
    additionalMedicareWages: number;
    form941: {
      line2: number;
      line3: number;
      line5a: number;
      line5aTax: number;
      line5c: number;
      line5cTax: number;
      line5d: number;
      line5dTax: number;
      line6: number;
    };
    depositsDue: number;
  };
}

/**
 * The payroll register for a period: per employee and in total. `yearToDate` holds this year's
 * stubs paid before the period starts, so the Social Security, FUTA and additional Medicare wage
 * bases are applied the way they are on the returns.
 */
export function buildRegister(period: Period, stubs: PaidStub[], yearToDate: PaidStub[]): Register {
  const range = periodRange(period);
  const prior = new Map<string, { ss: number; futa: number; medicare: number }>();
  for (const s of yearToDate) {
    const p = prior.get(s.employeeId) ?? { ss: 0, futa: 0, medicare: 0 };
    const fica = s.figures.gross - s.figures.health;
    prior.set(s.employeeId, {
      ss: p.ss + fica,
      futa: p.futa + fica,
      medicare: p.medicare + fica,
    });
  }

  const rows = new Map<string, RegisterRow>();
  const states = new Map<string, { code: string; wages: number; tax: number }>();
  const months = new Map<string, number>();
  let additionalMedicareWages = 0;
  for (const s of stubs) {
    const f = s.figures;
    const fica = f.gross - f.health;
    const p = prior.get(s.employeeId) ?? { ss: 0, futa: 0, medicare: 0 };
    const ssWages = Math.max(0, Math.min(fica, SOCIAL_SECURITY_WAGE_BASE - p.ss));
    const futaWages = Math.max(0, Math.min(fica, FUTA_WAGE_BASE - p.futa));
    const extraMedicare = Math.max(0, Math.min(fica, p.medicare + fica - ADDITIONAL_MEDICARE_THRESHOLD));
    additionalMedicareWages += extraMedicare;
    prior.set(s.employeeId, {
      ss: p.ss + fica,
      futa: p.futa + fica,
      medicare: p.medicare + fica,
    });

    const row =
      rows.get(s.employeeId) ??
      ({
        employeeId: s.employeeId,
        name: `${s.lastName}, ${s.firstName}`,
        stubs: 0,
        ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, 0])),
      } as RegisterRow);
    const add: Record<(typeof NUMERIC_KEYS)[number], number> = {
      gross: f.gross,
      retirement: f.retirement,
      health: f.health,
      otherDeductions: f.otherDeductions,
      federalWages: f.gross - f.retirement - f.health,
      socialSecurityWages: ssWages,
      medicareWages: fica,
      futaWages,
      federal: f.federal,
      socialSecurity: f.socialSecurity,
      medicare: f.medicare,
      state: f.state,
      local: f.local,
      net: f.net,
    };
    for (const k of NUMERIC_KEYS) row[k] = cents(row[k] + add[k]);
    row.stubs += 1;
    rows.set(s.employeeId, row);

    if (f.stateCode) {
      const st = states.get(f.stateCode) ?? {
        code: f.stateCode,
        wages: 0,
        tax: 0,
      };
      st.wages = cents(st.wages + f.gross - f.health - (STATES_TAXING_401K.has(f.stateCode) ? 0 : f.retirement));
      st.tax = cents(st.tax + f.state);
      states.set(f.stateCode, st);
    }
    // Federal deposit liability on this pay date: income tax withheld plus both halves of FICA.
    const liability = f.federal + ssWages * SOCIAL_SECURITY_RATE * 2 + fica * MEDICARE_RATE * 2 + extraMedicare * ADDITIONAL_MEDICARE_RATE;
    const month = s.payDate.slice(0, 7);
    months.set(month, cents((months.get(month) ?? 0) + liability));
  }

  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totals = {
    stubs: list.reduce((n, r) => n + r.stubs, 0),
    ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, cents(list.reduce((s, r) => s + r[k], 0))])),
  } as Register['totals'];
  additionalMedicareWages = cents(additionalMedicareWages);
  const line5aTax = cents(totals.socialSecurityWages * SOCIAL_SECURITY_RATE * 2);
  const line5cTax = cents(totals.medicareWages * MEDICARE_RATE * 2);
  const line5dTax = cents(additionalMedicareWages * ADDITIONAL_MEDICARE_RATE);
  const line6 = cents(totals.federal + line5aTax + line5cTax + line5dTax);
  return {
    period: { ...period, ...range },
    employees: list,
    totals,
    states: [...states.values()].sort((a, b) => a.code.localeCompare(b.code)),
    months: [...months.entries()].sort().map(([month, liability]) => ({ month, liability })),
    employer: {
      socialSecurity: cents(totals.socialSecurityWages * SOCIAL_SECURITY_RATE),
      medicare: cents(totals.medicareWages * MEDICARE_RATE),
      futa: cents(totals.futaWages * FUTA_RATE),
      additionalMedicareWages,
      form941: {
        line2: totals.federalWages,
        line3: totals.federal,
        line5a: totals.socialSecurityWages,
        line5aTax,
        line5c: totals.medicareWages,
        line5cTax,
        line5d: additionalMedicareWages,
        line5dTax,
        line6,
      },
      depositsDue: line6,
    },
  };
}

/** Loads and builds the register for a period. */
export async function loadRegister(period: Period): Promise<Register> {
  const range = periodRange(period);
  const [stubs, earlier] = await Promise.all([paidStubs(range.from, range.to), range.from.endsWith('-01-01') ? Promise.resolve([]) : paidStubs(`${period.year}-01-01`, prevDay(range.from))]);
  return buildRegister(period, stubs, earlier);
}

function prevDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The register as CSV for an auditor or accountant: one row per employee, then totals. */
export function registerCsv(r: Register): string {
  const cols: [string, keyof RegisterRow][] = [
    ['Employee', 'name'],
    ['Pay stubs', 'stubs'],
    ['Gross pay', 'gross'],
    ['401(k)', 'retirement'],
    ['Health insurance (pre-tax)', 'health'],
    ['Other deductions', 'otherDeductions'],
    ['Federal taxable wages', 'federalWages'],
    ['Social Security wages', 'socialSecurityWages'],
    ['Medicare wages', 'medicareWages'],
    ['FUTA wages', 'futaWages'],
    ['Federal income tax', 'federal'],
    ['Social Security tax', 'socialSecurity'],
    ['Medicare tax', 'medicare'],
    ['State income tax', 'state'],
    ['Local tax', 'local'],
    ['Net pay', 'net'],
  ];
  const esc = (v: string | number) => (typeof v === 'number' ? v.toFixed(2) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (row: Record<string, string | number>) => cols.map(([, k]) => (k === 'stubs' ? String(row[k]) : esc(row[k]))).join(',');
  const e = r.employer;
  const f = e.form941;
  return [
    `Payroll register,${esc(r.period.label)},${r.period.from} to ${r.period.to} (by pay date; processed pay runs only)`,
    '',
    cols.map(([h]) => esc(h)).join(','),
    ...r.employees.map((row) => line(row as unknown as Record<string, string | number>)),
    line({ ...r.totals, name: 'TOTAL' } as unknown as Record<string, string | number>),
    '',
    'Employer taxes,Amount',
    `Employer Social Security (6.2%),${esc(e.socialSecurity)}`,
    `Employer Medicare (1.45%),${esc(e.medicare)}`,
    `FUTA (0.6% of first $7000 per employee),${esc(e.futa)}`,
    '',
    'Form 941 figures,Amount',
    `Line 2 Wages tips and other compensation,${esc(f.line2)}`,
    `Line 3 Federal income tax withheld,${esc(f.line3)}`,
    `Line 5a Taxable social security wages,${esc(f.line5a)},${esc(f.line5aTax)}`,
    `Line 5c Taxable Medicare wages,${esc(f.line5c)},${esc(f.line5cTax)}`,
    `Line 5d Wages subject to Additional Medicare,${esc(f.line5d)},${esc(f.line5dTax)}`,
    `Line 6 Total taxes before adjustments,${esc(f.line6)}`,
    '',
    'Federal deposit liability by month,Amount',
    ...r.months.map((m) => `${m.month},${esc(m.liability)}`),
    '',
    'State,State wages,State tax withheld',
    ...r.states.map((s) => `${s.code},${esc(s.wages)},${esc(s.tax)}`),
  ].join('\n');
}
