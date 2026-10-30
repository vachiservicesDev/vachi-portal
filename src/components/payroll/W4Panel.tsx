'use client';

import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { CheckboxField, Fieldset, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Panel } from '@/components/ui/ui';
import { W4Fields, readW4 } from './W4Fields';
import type { TaxSetup } from '@/lib/payroll/w4';

const LABELS = { federal: 'Federal W-4', state: 'State withholding', ssnLast4: 'SSN last 4', signedName: 'Signature', perjury: 'Statement' };

/**
 * The employee's own Form W-4 and state withholding form, signed by typing their name under the
 * W-4's penalties-of-perjury statement. HR is notified, and the next pay stub uses it.
 */
export function W4Panel({ id }: { id?: string }) {
  const { data, error, reload } = useResource<{ workState: string | null; name: string; w4: TaxSetup }>('/api/me/w4');
  const action = useAction();
  const [perjury, setPerjury] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = { ...readW4(form), ssnLast4: String(form.get('ssnLast4') ?? ''), signedName: String(form.get('signedName') ?? ''), perjury };
    const result = await action.run('w4', '/api/me/w4', { method: 'PUT', body }, 'Signed and saved. HR has been told, and your next pay stub uses it.');
    if (result.ok) {
      setPerjury(false);
      await reload();
    }
  }

  if (error) return <Alert title="Couldn't load your tax forms">{error}</Alert>;
  if (!data) return null;
  const f = data.w4.federal;
  return (
    <div id={id}>
      <Panel
        title="Tax withholding: Form W-4 and state form"
        description={
          <>
            Copy your answers from the{' '}
            <a className="link" href="https://www.irs.gov/pub/irs-pdf/fw4.pdf" target="_blank" rel="noreferrer">
              IRS Form W-4
            </a>{' '}
            (the{' '}
            <a className="link" href="https://www.irs.gov/individuals/tax-withholding-estimator" target="_blank" rel="noreferrer">
              IRS Tax Withholding Estimator
            </a>{' '}
            can help).{' '}
            {f?.submittedAt
              ? `On file since ${new Date(f.submittedAt).toLocaleDateString('en-US')}${f.signedName ? `, signed by ${f.signedName}` : ''}. Submit again any time your situation changes.`
              : 'Fill this in before your first paycheck. Without it, federal tax is withheld as single with no adjustments.'}
          </>
        }
      >
        <form onSubmit={save} noValidate className="grid gap-6">
          <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
          <W4Fields setup={data.w4} workState={data.workState} errors={action.fieldErrors} />
          <Fieldset legend="Sign">
            <TextField
              name="ssnLast4"
              label="Last 4 digits of your Social Security number"
              inputMode="numeric"
              maxLength={4}
              required
              defaultValue={data.w4.ssnLast4 ?? ''}
              errors={action.fieldErrors}
              hint="Printed as XXX-XX-1234 on your W-2. The full number is never stored here; give it to HR privately."
              className="sm:max-w-xs"
            />
            <TextField name="signedName" label="Your full name" required defaultValue={data.name} errors={action.fieldErrors} hint="Typing your name is your signature." className="sm:max-w-md" />
            <CheckboxField
              name="perjury"
              label="Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete."
              checked={perjury}
              onChange={(e) => setPerjury(e.target.checked)}
              errors={action.fieldErrors}
            />
          </Fieldset>
          <div>
            <Button type="submit" busy={action.busy === 'w4'} busyLabel="Saving" disabled={!perjury}>
              Sign and save
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
