'use client';

import { useState } from 'react';
import { api, useAction } from '@/lib/client/api';
import { fullName } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, Fieldset, SelectField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, formatMoney } from '@/components/ui/ui';
import { buildStub, stubInputSchema } from '@/lib/payroll/stub';
import { computeTaxes } from '@/lib/payroll/taxes';
import { FILING_STATUSES, NO_WAGE_TAX_STATES, PAY_FREQUENCY_LABELS, type PayFrequency, type TaxSetup } from '@/lib/payroll/w4';

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Suggestion {
  payType: 'hourly' | 'salary';
  payRate: number | null;
  salaryPerPeriod: number | null;
  frequency: PayFrequency;
  workState: string | null;
  setup: TaxSetup;
  regularHours: number;
  overtimeHours: number;
  ficaWagesYtd: number;
  lastDeductions: { retirement: number | null; healthInsurance: number | null };
  depositLast4: string | null;
  paymentMethod: 'direct_deposit' | 'check';
  missing: string[];
}

const LABELS: Record<string, string> = {
  employeeId: 'Employee',
  regularHours: 'Regular hours',
  regularRate: 'Hourly rate',
  overtimeHours: 'Overtime hours',
  overtimeRate: 'Overtime rate',
  salary: 'Salary',
  bonus: 'Bonus',
  otherEarnings: 'Other earnings',
  federalTax: 'Federal income tax',
  socialSecurity: 'Social Security',
  medicare: 'Medicare',
  stateTax: 'State income tax',
  stateCode: 'State',
  localTax: 'Local tax',
  retirement: '401(k)',
  healthInsurance: 'Health insurance',
  otherDeduction: 'Other deduction',
  depositLast4: 'Account last 4',
};

const TAX_FIELDS = ['federalTax', 'socialSecurity', 'medicare', 'stateTax'] as const;
type TaxField = (typeof TAX_FIELDS)[number];

type Values = Record<string, string>;
const EMPTY: Values = { paymentMethod: 'direct_deposit' };
const money = { type: 'number' as const, inputMode: 'decimal' as const, min: 0, step: '0.01' };
const n = (s: string | undefined) => (s ? Number(s) || 0 : 0);
const str = (x: number | null | undefined) => (x === null || x === undefined || x === 0 ? '' : String(x));

/**
 * HR's pay stub entry. Picking an employee fills hours from approved timesheets and pay from their
 * setup; taxes calculate live from their W-4, state and year-to-date wages. Any tax HR types over
 * stays as typed.
 */
export function StubForm({ runId, employees, onAdded }: { runId: string; employees: EmployeeOption[]; onAdded: () => void }) {
  const action = useAction();
  const [v, setV] = useState<Values>(EMPTY);
  const [manual, setManual] = useState<Set<TaxField>>(new Set());
  const [hint, setHint] = useState<Suggestion | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setV((p) => ({ ...p, [k]: value }));
    if ((TAX_FIELDS as readonly string[]).includes(k)) setManual((m) => new Set(m).add(k as TaxField));
  };

  // Gross from the earnings typed so far, then taxes from the employee's setup.
  const gross = n(v.regularHours) * n(v.regularRate) + n(v.overtimeHours) * n(v.overtimeRate) + n(v.salary) + n(v.bonus) + n(v.otherEarnings);
  const auto = hint
    ? computeTaxes({
        gross,
        retirement: n(v.retirement),
        healthInsurance: n(v.healthInsurance),
        frequency: hint.frequency,
        setup: hint.setup,
        workState: v.stateCode || hint.workState,
        ficaWagesYtd: hint.ficaWagesYtd,
      })
    : null;
  const taxValue = (k: TaxField) => (manual.has(k) || !auto || auto[k] === null ? (v[k] ?? '') : (auto[k] as number).toFixed(2));
  const values: Values = { ...v, ...Object.fromEntries(TAX_FIELDS.map((k) => [k, taxValue(k)])) };
  const field = (k: string) => ({ name: k, value: values[k] ?? '', onChange: set(k), errors: action.fieldErrors });

  const parsed = stubInputSchema.safeParse({ ...Object.fromEntries(Object.entries(values).filter(([, x]) => x !== '')), employeeId: v.employeeId || '00000000-0000-4000-8000-000000000000' });
  const preview = parsed.success ? buildStub(parsed.data) : null;

  async function chooseEmployee(e: React.ChangeEvent<HTMLSelectElement>) {
    const employeeId = e.target.value;
    setV({ ...EMPTY, employeeId });
    setManual(new Set());
    setHint(null);
    if (!employeeId) return;
    const r = await api<Suggestion>(`/api/payroll/runs/${runId}/suggest?employeeId=${employeeId}`);
    if (!r.ok || !r.data) return;
    const s = r.data;
    setHint(s);
    const hourly = s.payType === 'hourly';
    setV((p) => ({
      ...p,
      regularHours: hourly ? str(s.regularHours) : '',
      regularRate: hourly ? str(s.payRate) : '',
      overtimeHours: hourly ? str(s.overtimeHours) : '',
      overtimeRate: hourly && s.payRate ? String(Math.round(s.payRate * 1.5 * 100) / 100) : '',
      salary: hourly ? '' : str(s.salaryPerPeriod),
      retirement: str(s.lastDeductions.retirement),
      healthInsurance: str(s.lastDeductions.healthInsurance),
      filingStatus: s.setup.federal?.filingStatus ?? '',
      depositLast4: s.depositLast4 ?? '',
      paymentMethod: s.paymentMethod,
      stateCode: s.workState ?? '',
    }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(values).filter(([, x]) => x !== ''));
    const result = await action.run('stub', `/api/payroll/runs/${runId}/stubs`, { body }, 'Pay stub added. The employee sees it once you mark the run processed.');
    if (result.ok) {
      setV(EMPTY);
      setManual(new Set());
      setHint(null);
      onAdded();
    }
  }

  const autoHint = (k: TaxField, text: string) => (manual.has(k) ? 'Entered by you.' : auto && auto[k] !== null ? `Calculated: ${text}` : undefined);
  const stateCode = (v.stateCode || hint?.workState || '').toUpperCase();

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-6 border-t border-line pt-6">
      <h3 className="font-display text-lg font-semibold text-ink">Add a pay stub</h3>
      <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
      <SelectField
        name="employeeId"
        label="Employee"
        required
        placeholder="Choose an employee"
        value={v.employeeId ?? ''}
        onChange={chooseEmployee}
        options={employees.map((e) => ({ value: e.id, label: fullName(e.firstName, e.lastName) }))}
        errors={action.fieldErrors}
        hint={
          hint
            ? `${hint.payType === 'salary' ? 'Salaried' : 'Hourly'}, paid ${PAY_FREQUENCY_LABELS[hint.frequency].toLowerCase()}. Hours from approved timesheets: ${hint.regularHours} regular, ${hint.overtimeHours} overtime.`
            : undefined
        }
      />
      {hint && hint.missing.length > 0 && (
        <Alert tone="info" title="Finish their pay setup for a complete stub">
          Missing: {hint.missing.join(', ')}. Add it on their employee page under Pay and tax.
        </Alert>
      )}

      {v.employeeId && (
        <>
          <Fieldset legend="Earnings">
            <FieldRow>
              <TextField label="Regular hours" {...money} step="0.25" {...field('regularHours')} />
              <TextField label="Hourly rate (USD)" {...money} {...field('regularRate')} />
            </FieldRow>
            <FieldRow>
              <TextField label="Overtime hours" {...money} step="0.25" {...field('overtimeHours')} />
              <TextField label="Overtime rate (USD)" {...money} {...field('overtimeRate')} hint="1.5× the hourly rate." />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField label="Salary for this period (USD)" {...money} {...field('salary')} />
              <TextField label="Bonus (USD)" {...money} {...field('bonus')} />
              <TextField label="Other earnings (USD)" {...money} {...field('otherEarnings')} />
            </FieldRow>
            {v.otherEarnings && <TextField label="Other earnings description" maxLength={60} {...field('otherEarningsLabel')} className="sm:max-w-sm" />}
          </Fieldset>

          <Fieldset legend="Deductions">
            <FieldRow cols={3}>
              <TextField label="401(k) (USD)" {...money} {...field('retirement')} hint="Pre-tax." />
              <TextField label="Health insurance (USD)" {...money} {...field('healthInsurance')} hint="Pre-tax." />
              <TextField label="Other deduction (USD)" {...money} {...field('otherDeduction')} hint="After tax." />
            </FieldRow>
            {v.otherDeduction && <TextField label="Other deduction description" maxLength={60} {...field('otherDeductionLabel')} className="sm:max-w-sm" />}
          </Fieldset>

          <Fieldset legend="Taxes withheld">
            <FieldRow cols={3}>
              <TextField
                label="Federal income tax (USD)"
                {...money}
                {...field('federalTax')}
                hint={autoHint('federalTax', `from their W-4 (${hint?.setup.federal ? FILING_STATUSES[hint.setup.federal.filingStatus] : ''}).`) ?? 'No W-4 on file: enter it.'}
              />
              <TextField label="Social Security (USD)" {...money} {...field('socialSecurity')} hint={autoHint('socialSecurity', '6.2% up to the yearly wage base.')} />
              <TextField label="Medicare (USD)" {...money} {...field('medicare')} hint={autoHint('medicare', '1.45%, plus 0.9% over $200,000.')} />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField label="State" maxLength={2} placeholder="TX" {...field('stateCode')} />
              <TextField
                label="State income tax (USD)"
                {...money}
                {...field('stateTax')}
                hint={
                  stateCode && NO_WAGE_TAX_STATES.includes(stateCode)
                    ? `${stateCode} has no state income tax.`
                    : (autoHint('stateTax', `from the ${stateCode} 2026 formula and their state form.`) ?? 'Enter it, or set their work state to calculate it.')
                }
              />
              <TextField label="Local tax (USD)" {...money} {...field('localTax')} />
            </FieldRow>
          </Fieldset>

          <Fieldset legend="Payment">
            <FieldRow>
              <SelectField
                label="Paid by"
                required
                options={[
                  { value: 'direct_deposit', label: 'Direct deposit' },
                  { value: 'check', label: 'Paper check' },
                ]}
                {...field('paymentMethod')}
              />
              {v.paymentMethod !== 'check' && <TextField label="Deposit account, last 4 digits" inputMode="numeric" maxLength={4} {...field('depositLast4')} hint="Only the last 4 are stored and printed." />}
            </FieldRow>
          </Fieldset>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-navy-50 px-4 py-3" aria-live="polite">
            {preview ? (
              <p className="text-ink">
                Gross <strong>{formatMoney(preview.grossPay)}</strong> − taxes {formatMoney(preview.detail.taxes.reduce((s, t) => s + t.amount, 0))} − deductions{' '}
                {formatMoney(preview.detail.deductions.reduce((s, d) => s + d.amount, 0))} = net{' '}
                <strong className={preview.netPay < 0 ? 'text-danger-700' : ''}>{formatMoney(preview.netPay)}</strong>
              </p>
            ) : (
              <p className="text-muted">Totals appear as you fill in the figures.</p>
            )}
            <Button type="submit" busy={action.busy === 'stub'} busyLabel="Adding…">
              Add pay stub
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
