'use client';

import { CheckboxField, FieldRow, Fieldset, SelectField, TextField, type FieldErrors } from '@/components/ui/fields';
import { FILING_STATUSES, NO_WAGE_TAX_STATES, type TaxSetup } from '@/lib/payroll/w4';

const money = { type: 'number' as const, inputMode: 'decimal' as const, min: 0, step: '0.01' };
const str = (n: number | undefined) => (n ? String(n) : '');

/** Form W-4 (2020 or later), steps 1(c) to 4, plus the employee's state withholding form. */
export function W4Fields({ setup, workState, errors }: { setup: TaxSetup; workState?: string | null; errors?: FieldErrors }) {
  const f = setup.federal;
  const s = setup.state;
  const noStateTax = !!workState && NO_WAGE_TAX_STATES.includes(workState);
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

      <Fieldset legend="State withholding">
        {noStateTax ? (
          <p className="text-ink-2">{workState} has no state income tax on wages, so nothing is withheld.</p>
        ) : (
          <FieldRow cols={3}>
            <SelectField
              name="st_mode"
              label="How to withhold"
              hideOptional
              defaultValue={s?.mode ?? 'none'}
              options={[
                { value: 'none', label: 'Not set up yet' },
                { value: 'percent', label: 'Percent of taxable pay' },
                { value: 'amount', label: 'Fixed amount per period' },
              ]}
            />
            <TextField name="st_value" label="Percent or amount" {...money} defaultValue={str(s?.value)} errors={errors} />
            <TextField name="st_extra" label="Extra per period (USD)" {...money} defaultValue={str(s?.extra)} errors={errors} />
          </FieldRow>
        )}
      </Fieldset>
    </>
  );
}

/** Reads W4Fields back into the shape the API expects. */
export function readW4(form: FormData) {
  const num = (k: string) => Number(form.get(k) || 0);
  const state = form.has('st_mode') ? { mode: String(form.get('st_mode')), value: num('st_value'), extra: num('st_extra') } : undefined;
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
