'use client';

import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { FieldRow, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Loading, PageHeader, Panel } from '@/components/ui/ui';

interface Company {
  name: string;
  address: string;
  ein: string;
  phone: string;
}

const LABELS = { legalName: 'Legal name', address: 'Address', ein: 'EIN', phone: 'Phone' };

export default function CompanyPage() {
  const { data, error, loading, reload } = useResource<{ company: Company }>('/api/admin/company');
  const action = useAction();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(['legalName', 'address', 'ein', 'phone'].map((k) => [k, String(form.get(k) ?? '')]));
    const result = await action.run('save', '/api/admin/company', { method: 'PUT', body }, 'Saved. Every pay stub now shows these details.');
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  const c = data?.company;
  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Company details" lead="The employer name, address and EIN printed at the top of every pay stub." />
      {error && <Alert title="Couldn't load company details">{error}</Alert>}
      {c && (
        <Panel title="Employer">
          <form onSubmit={save} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
            <TextField name="legalName" label="Legal name" required maxLength={200} defaultValue={c.name} errors={action.fieldErrors} className="sm:max-w-md" />
            <TextAreaField name="address" label="Address" rows={3} maxLength={500} defaultValue={c.address} errors={action.fieldErrors} hint="Street, city, state and ZIP, on separate lines." />
            <FieldRow>
              <TextField name="ein" label="EIN (federal employer ID)" maxLength={10} placeholder="12-3456789" defaultValue={c.ein} errors={action.fieldErrors} />
              <TextField name="phone" label="Phone" type="tel" maxLength={30} defaultValue={c.phone} errors={action.fieldErrors} />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving">
                Save
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </>
  );
}
