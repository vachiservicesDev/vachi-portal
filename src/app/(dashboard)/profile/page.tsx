'use client';

import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Loading, PageHeader, Panel } from '@/components/ui/ui';
import { W4Fields, readW4 } from '@/components/payroll/W4Fields';
import type { TaxSetup } from '@/lib/payroll/w4';

/** The employee fills in their own W-4, as on the paper form. HR is notified. */
function W4Panel() {
  const { data, error, reload } = useResource<{ workState: string | null; w4: TaxSetup }>('/api/me/w4');
  const action = useAction();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action.run('w4', '/api/me/w4', { method: 'PUT', body: readW4(new FormData(e.currentTarget)) }, 'Saved. HR has been told, and your next pay stub uses it.');
    if (result.ok) await reload();
  }

  if (error) return <Alert title="Couldn't load your W-4">{error}</Alert>;
  if (!data) return null;
  const submitted = data.w4.federal?.submittedAt;
  return (
    <Panel
      title="Tax withholding (Form W-4)"
      description={
        <>
          Copy your answers from the{' '}
          <a className="link" href="https://www.irs.gov/pub/irs-pdf/fw4.pdf" target="_blank" rel="noreferrer">
            IRS Form W-4
          </a>
          . The IRS Tax Withholding Estimator can help you fill it in.{submitted ? ` Last updated ${new Date(submitted).toLocaleDateString('en-US')}.` : ''}
        </>
      }
    >
      <form onSubmit={save} noValidate className="grid gap-6">
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ federal: 'Federal W-4', state: 'State withholding' }} />
        <W4Fields setup={data.w4} workState={data.workState} errors={action.fieldErrors} />
        <div>
          <Button type="submit" busy={action.busy === 'w4'} busyLabel="Saving">
            Save W-4
          </Button>
        </div>
      </form>
    </Panel>
  );
}

interface Me {
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  department: string | null;
  phoneNumber: string | null;
  address: string | null;
}

export default function ProfilePage() {
  const { data, error, loading, reload } = useResource<{ employee: Me }>('/api/me/profile');
  const action = useAction();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await action.run(
      'save',
      '/api/me/profile',
      { method: 'PATCH', body: { phoneNumber: String(form.get('phoneNumber') ?? ''), address: String(form.get('address') ?? '') } },
      'Saved. Your next pay stub will use this address.',
    );
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  const me = data?.employee;

  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" lead="Keep your contact details current. Your mailing address is printed on your pay stubs." />
      {error && <Alert title="Couldn't load your profile">{error}</Alert>}
      {me && (
        <div className="grid gap-6">
          <Panel title="Details HR manages" description="Ask HR if any of these need to change.">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Name', `${me.firstName} ${me.lastName}`],
                ['Work email', me.email],
                ['Position', me.position || '—'],
                ['Department', me.department || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="t-label text-muted">{k}</dt>
                  <dd className="mt-1 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Contact details">
            <form onSubmit={save} noValidate className="grid gap-5">
              <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ phoneNumber: 'Phone', address: 'Mailing address' }} />
              <TextField name="phoneNumber" label="Phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} defaultValue={me.phoneNumber} errors={action.fieldErrors} className="sm:max-w-sm" />
              <TextAreaField
                name="address"
                label="Mailing address"
                rows={3}
                maxLength={500}
                defaultValue={me.address}
                errors={action.fieldErrors}
                hint="Street, city, state and ZIP, on separate lines."
              />
              <div>
                <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving">
                  Save
                </Button>
              </div>
            </form>
          </Panel>
          <W4Panel />
        </div>
      )}
    </>
  );
}
