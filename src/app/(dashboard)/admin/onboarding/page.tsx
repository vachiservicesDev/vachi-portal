'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { statusOf, VISA_TYPES } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { FieldRow, SelectField, TextField } from '@/components/ui/fields';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface OnboardingSession {
  id: string;
  employmentType: 'w2' | '1099';
  status: string;
  createdAt: string;
  formData: { employeeName?: string; startDate?: string; position?: string };
}

const LABELS = {
  firstName: 'First name',
  lastName: 'Last name',
  employeeEmail: 'Employee email',
  employmentType: 'Employment type',
  startDate: 'Start date',
};

export default function AdminOnboardingPage() {
  const { data, error, loading, reload } = useResource<{ sessions: OnboardingSession[] }>('/api/onboarding/sessions');
  const [showForm, setShowForm] = useState(false);
  const action = useAction();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('create', '/api/onboarding/sessions', { body: formValues(form) }, 'Onboarding started. Open it to generate and send the documents.');
    if (result.ok) {
      form.reset();
      setShowForm(false);
      await reload();
    }
  }

  const sessions = data?.sessions ?? [];

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Onboarding"
        lead="Start onboarding for a new hire, generate their documents and send them for e-signature."
        actions={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => (setShowForm((v) => !v), action.clear())} aria-expanded={showForm} aria-controls="new-onboarding">
            {showForm ? 'Cancel' : 'Start onboarding'}
          </Button>
        }
      />

      <div className="grid gap-6">
        {!showForm && action.success && <FormStatus success={action.success} />}
        {showForm && (
          <Panel id="new-onboarding" title="New hire" description="If the employee already exists, their record is reused.">
            <form onSubmit={handleCreate} className="grid gap-5">
              <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={LABELS} />
              <FieldRow>
                <TextField name="firstName" label="First name" required errors={action.fieldErrors} />
                <TextField name="lastName" label="Last name" required errors={action.fieldErrors} />
              </FieldRow>
              <FieldRow>
                <TextField name="employeeEmail" label="Employee email" type="email" inputMode="email" required errors={action.fieldErrors} />
                <TextField name="startDate" label="Start date" type="date" required errors={action.fieldErrors} />
              </FieldRow>
              <FieldRow cols={3}>
                <SelectField
                  name="employmentType"
                  label="Employment type"
                  required
                  defaultValue="w2"
                  errors={action.fieldErrors}
                  options={[
                    { value: 'w2', label: 'W-2 employee' },
                    { value: '1099', label: '1099 contractor' },
                  ]}
                />
                <SelectField name="visaType" label="Work authorization" defaultValue="Other" errors={action.fieldErrors} options={VISA_TYPES} />
                <TextField name="position" label="Position" errors={action.fieldErrors} />
              </FieldRow>
              <TextField name="department" label="Department" className="sm:max-w-sm" errors={action.fieldErrors} />
              <div className="flex justify-end border-t border-line pt-5">
                <Button type="submit" busy={action.busy === 'create'} busyLabel="Starting">
                  Start onboarding
                </Button>
              </div>
            </form>
          </Panel>
        )}

        {error && <Alert title="Couldn't load onboarding">{error}</Alert>}
        {loading && !data ? (
          <Loading />
        ) : sessions.length === 0 ? (
          <EmptyState title="No onboarding yet">Start onboarding for your next hire to generate their documents.</EmptyState>
        ) : (
          <DataTable
            caption="Onboarding sessions"
            rows={sessions}
            rowKey={(s) => s.id}
            columns={[
              {
                header: 'Employee',
                primary: true,
                cell: (s) => (
                  <Link href={`/admin/onboarding/${s.id}`} className="font-semibold text-navy-700 hover:underline">
                    {s.formData?.employeeName ?? 'Unnamed'}
                  </Link>
                ),
              },
              { header: 'Type', cell: (s) => (s.employmentType === 'w2' ? 'W-2' : '1099') },
              { header: 'Start date', cell: (s) => <When iso={s.formData?.startDate} /> },
              { header: 'Started', cell: (s) => <When iso={s.createdAt} /> },
              {
                header: 'Status',
                cell: (s) => {
                  const st = statusOf('onboarding', s.status);
                  return <Chip tone={st.tone}>{st.label}</Chip>;
                },
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
