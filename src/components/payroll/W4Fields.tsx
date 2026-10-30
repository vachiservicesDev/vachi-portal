'use client';

import { CheckboxField, FieldRow, Fieldset, SelectField, TextField, type FieldErrors } from '@/components/ui/fields';
import { useState } from 'react';
import { FILING_STATUSES, NO_WAGE_TAX_STATES, defaultStateStatus, type TaxSetup } from '@/lib/payroll/w4';
import { STATE_RULES } from '@/lib/payroll/states/rules';

const money = { type: 'number' as const, inputMode: 'decimal' as const, min: 0, step: '0.01' };
const str = (n: number | undefined) => (n ? String(n) : '');

/** Form W-4 (2020 or later), steps 1(c) to 4, plus the employee's state withholding form. */
export function W4Fields({ setup, workState, errors }: { setup: TaxSetup; workState?: string | null; errors?: FieldErrors }) {
  const f = setup.federal;
  return (
    <>
      <Fieldset legend="Federal Form W-4">
        <SelectField
          name="w4_filingStatus"
          label="Step 1(c): Filing status"
          required
          defaultValue={f?.filingStatus ?? 'single'}
          options={Object.entries(FILING_STATUSES).map(([value, label]) => ({ value, label }))}
          errors={errors}
          className="sm:max-w-md"
        />
        <CheckboxField
          name="w4_multipleJobs"
          label="Step 2(c): Two jobs total, or married filing jointly and the spouse works"
          defaultChecked={f?.multipleJobs}
          hint="Check only if the box is checked on the form."
        />
        <FieldRow>
          <TextField name="w4_dependentsAmount" label="Step 3: Claim dependents and other credits (USD per year)" {...money} defaultValue={str(f?.dependentsAmount)} errors={errors} />
          <TextField name="w4_otherIncome" label="Step 4(a): Other income (USD per year)" {...money} defaultValue={str(f?.otherIncome)} errors={errors} />
        </FieldRow>
        <FieldRow>
          <TextField name="w4_deductions" label="Step 4(b): Deductions (USD per year)" {...money} defaultValue={str(f?.deductions)} errors={errors} />
          <TextField name="w4_extraWithholding" label="Step 4(c): Extra withholding (USD per pay period)" {...money} defaultValue={str(f?.extraWithholding)} errors={errors} />
        </FieldRow>
        <CheckboxField name="w4_exempt" label="Exempt from federal withholding" defaultChecked={f?.exempt} hint="Only if “Exempt” is written on the form. It must be renewed each February." />
      </Fieldset>

      <StateFields key={workState ?? ''} setup={setup} workState={workState} errors={errors} />
    </>
  );
}

/** Reads W4Fields back into the shape the API expects. */
export function readW4(form: FormData) {
  const num = (k: string) => Number(form.get(k) || 0);
  const opt = (k: string) => (form.get(k) === null || form.get(k) === '' ? undefined : String(form.get(k)));
  const state = form.has('st_mode')
    ? {
        mode: String(form.get('st_mode')),
        status: opt('st_status'),
        allowances: opt('st_allowances'),
        dependents: opt('st_dependents'),
        amount: opt('st_amount'),
        locality: opt('st_locality'),
        exempt: form.get('st_exempt') === 'on',
        value: num('st_value'),
        extra: num('st_extra'),
      }
    : undefined;
  return {
    federal: {
      filingStatus: String(form.get('w4_filingStatus') || 'single'),
      multipleJobs: form.get('w4_multipleJobs') === 'on',
      dependentsAmount: num('w4_dependentsAmount'),
      otherIncome: num('w4_otherIncome'),
      deductions: num('w4_deductions'),
      extraWithholding: num('w4_extraWithholding'),
      exempt: form.get('w4_exempt') === 'on',
    },
    ...(state && { state }),
  };
}

/** The work state's own withholding certificate, with the fields that state's formula uses. */
function StateFields({ setup, workState, errors }: { setup: TaxSetup; workState?: string | null; errors?: FieldErrors }) {
  const s = setup.state;
  const [mode, setMode] = useState(s?.mode === 'none' ? 'formula' : (s?.mode ?? 'formula'));
  const rule = workState ? STATE_RULES[workState] : undefined;
  if (!workState) return <p className="text-ink-2">Set the work state to see its withholding form.</p>;
  if (NO_WAGE_TAX_STATES.includes(workState)) {
    return (
      <Fieldset legend="State withholding">
        <p className="text-ink-2">{workState} has no state income tax on wages, so nothing is withheld.</p>
      </Fieldset>
    );
  }
  const counts = rule ? (Object.entries(rule.fields) as [string, string][]) : [];
  return (
    <Fieldset legend={rule ? `${rule.name} withholding (Form ${rule.form})` : `${workState} withholding`}>
      <input type="hidden" name="st_state" value={workState} />
      {rule && (
        <>
          {rule.statuses && (
            <SelectField
              name="st_status"
              label="Filing status on the state form"
              hideOptional
              defaultValue={s?.status || defaultStateStatus(workState, setup.federal)}
              options={Object.entries(rule.statuses).map(([value, label]) => ({ value, label }))}
              className="sm:max-w-md"
            />
          )}
          {counts.length > 0 && (
            <FieldRow cols={counts.length >= 3 ? 3 : 2}>
              {counts.map(([key, label]) => (
                <TextField
                  key={key}
                  name={`st_${key}`}
                  label={label}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={key === 'amount' ? '0.01' : '1'}
                  defaultValue={str(s?.[key as 'allowances' | 'dependents' | 'amount'])}
                  errors={errors}
                />
              ))}
            </FieldRow>
          )}
          {rule.localities && (
            <SelectField
              name="st_locality"
              label="County"
              hideOptional
              defaultValue={s?.locality ?? ''}
              placeholder="Choose the county they live in"
              options={Object.keys(rule.localities).map((c) => ({ value: c, label: c }))}
              className="sm:max-w-md"
            />
          )}
          <CheckboxField name="st_exempt" label="Exempt from state withholding" defaultChecked={s?.exempt} hint="Only if the state form claims exemption." />
        </>
      )}
      <FieldRow>
        <SelectField
          name="st_mode"
          label="How to calculate"
          hideOptional
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          options={[
            ...(rule ? [{ value: 'formula', label: `${rule.name}'s 2026 formula` }] : []),
            { value: 'percent', label: 'Fixed percent of taxable pay' },
            { value: 'amount', label: 'Fixed amount per period' },
          ]}
        />
        {mode !== 'formula' && <TextField name="st_value" label={mode === 'percent' ? 'Percent' : 'Amount (USD)'} {...money} defaultValue={str(s?.value)} errors={errors} />}
      </FieldRow>
      <TextField name="st_extra" label="Extra state withholding per period (USD)" {...money} defaultValue={str(s?.extra)} errors={errors} className="sm:max-w-xs" />
    </Fieldset>
  );
}
