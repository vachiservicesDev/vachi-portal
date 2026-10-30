'use client';

import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Loading, PageHeader, Panel } from '@/components/ui/ui';
import { W4Panel } from '@/components/payroll/W4Panel';

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
