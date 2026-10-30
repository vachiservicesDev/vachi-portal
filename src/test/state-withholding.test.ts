import { describe, expect, it } from 'vitest';
import { NO_WAGE_TAX_STATES, stateWithholding, w4Schema, type PayFrequency, type TaxSetup } from '@/lib/payroll/w4';
import { STATE_RULES } from '@/lib/payroll/states/rules';

const federal = w4Schema.parse({ filingStatus: 'single' });
const run = (state: string, st: Partial<NonNullable<TaxSetup['state']>> = {}, wages = 2000, frequency: PayFrequency = 'biweekly', federalTax = 156.15) =>
  stateWithholding(state, { federal, state: { mode: 'formula', exempt: false, value: 0, extra: 0, ...st } }, { wages, frequency, federalTax });

/**
 * $2,000 every two weeks ($52,000 a year), single, one allowance where the state form has them,
 * $156.15 federal withheld. Each figure was worked by hand from the state's published formula.
 */
const BIWEEKLY_2000: Record<string, number> = {
  AL: 82.96, AZ: 40, AR: 55.27, CA: 49.06, CO: 79, CT: 73.04, DE: 84.97, DC: 103.87, GA: 61.42, HI: 93.52, ID: 73, IL: 93.43, IN: 57.87, IA: 57,
  KS: 80.84, KY: 65.48, LA: 46.5, ME: 78, MD: 138.82, MA: 83.89, MI: 75.36, MN: 91.27, MS: 50, MO: 58, MT: 65, NE: 67.92, NJ: 56.38, NM: 63.72,
  NY: 84.22, NC: 58, ND: 0, OH: 45.13, OK: 69, OR: 129.14, PA: 61.4, RI: 73.56, SC: 71.23, UT: 89, VT: 54.99, VA: 83.69, WV: 59, WI: 88.07,
};

describe('state withholding, 2026 formulas', () => {
  it('covers every state with a wage tax, plus DC', () => {
    const all = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
    for (const s of all) expect(NO_WAGE_TAX_STATES.includes(s) || s in STATE_RULES, s).toBe(true);
    expect(Object.keys(STATE_RULES)).toHaveLength(42);
  });

  it.each(Object.entries(BIWEEKLY_2000))('%s: $2,000 biweekly, single', (state, expected) => {
    expect(run(state, { allowances: 1 })).toBe(expected);
  });

  it('no-tax states withhold nothing and exempt employees only their extra', () => {
    expect(run('TX')).toBe(0);
    expect(run('CA', { exempt: true, extra: 5 })).toBe(5);
    expect(run('CA', { mode: 'amount', value: 40, extra: 5 })).toBe(45);
    expect(run('CA', { mode: 'percent', value: 2 })).toBe(40);
    // Saved before the formulas existed as "not set up yet": now uses the formula.
    expect(run('CA', { mode: 'none', allowances: 1 })).toBe(BIWEEKLY_2000.CA);
  });

  it('Iowa matches the Department of Revenue 2026 examples', () => {
    expect(run('IA', { status: 'other', amount: 40 }, 2100)).toBe(59.26);
    expect(run('IA', { status: 'married', amount: 80 }, 2100)).toBe(38.72);
    expect(run('IA', { status: 'hoh', amount: 160 }, 5000, 'monthly')).toBe(114.92);
  });

  it('Arkansas matches the DFA formula example ($2,127 monthly, 2 exemptions)', () => {
    expect(run('AR', { allowances: 2 }, 2127, 'monthly')).toBe(36.5);
  });

  it('Connecticut adds the phase-out and recapture at higher wages', () => {
    // F, $210,000: 11,400 tax + 250 phase-out + 430 recapture, no credit.
    expect(run('CT', { status: 'F' }, 17_500, 'monthly', 0)).toBe(Math.round((12_080 / 12) * 100) / 100);
    // No CT-W4: 6.99% flat.
    expect(run('CT', { status: 'none' })).toBe(Math.round(2000 * 0.0699 * 100) / 100);
  });

  it('uses the federal filing status when the state form has none chosen', () => {
    const married = { federal: w4Schema.parse({ filingStatus: 'married_jointly' }) };
    expect(stateWithholding('CO', married, { wages: 2000, frequency: 'biweekly', federalTax: 0 })).toBe(Math.round(((52_000 - 11_000) * 0.044) / 26));
  });
});
