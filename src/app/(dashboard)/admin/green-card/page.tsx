'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface GcCase {
  id: string;
  employeeId: string;
  stage: string;
  priorityDate: string | null;
  stageUpdatedAt: string;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function AdminGreenCardPage() {
  const cases = useResource<{ cases: GcCase[] }>('/api/green-card');
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const list = cases.data?.cases ?? [];
  const withCase = new Set(list.map((c) => c.employeeId));
  const available = (people.data?.employees ?? []).filter((e) => e.status !== 'inactive' && !withCase.has(e.id));

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('create', '/api/green-card', { body: formValues(form) }, 'Case started at PERM preparation.');
    if (result.ok) {
      form.reset();
      cases.reload();
    }
  }

  return (
    <>
      <PageHeader eyebrow="Immigration" title="Green card sponsorship" lead="Track each sponsored employee from PERM through I-485. Employees see their current stage on their own page." />
      <div className="grid gap-8">
        <Panel title="Start a case">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ employeeId: 'Employee', priorityDate: 'Priority date' }} />
            {people.loading && !people.data ? (
              <Loading label="Loading employees" />
            ) : available.length === 0 ? (
              <p className="text-ink-2">Every active employee already has a case.</p>
            ) : (
              <>
                <FieldRow>
                  <SelectField
                    name="employeeId"
                    label="Employee"
                    required
                    placeholder="Choose an employee"
                    options={available.map((e) => ({ value: e.id, label: fullName(e.firstName, e.lastName) }))}
                    errors={action.fieldErrors}
                  />
                  <TextField name="priorityDate" label="Priority date" type="date" errors={action.fieldErrors} hint="Add it later if you don't have it yet." />
                </FieldRow>
                <div>
                  <Button type="submit" busy={action.busy === 'create'} busyLabel="Starting…">
                    Start case
                  </Button>
                </div>
              </>
            )}
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Cases</h2>
          {cases.error && <Alert title="Couldn't load cases">{cases.error}</Alert>}
          {cases.loading && !cases.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState>No green card cases yet.</EmptyState>
          ) : (
            <DataTable
              caption="Green card cases"
              rows={list}
              rowKey={(c) => c.id}
              columns={[
                {
                  header: 'Employee',
                  primary: true,
                  cell: (c) => (
                    <Link href={`/admin/green-card/${c.id}`} className="font-semibold text-navy-700 hover:underline">
                      {fullName(c.employeeFirstName, c.employeeLastName)}
                    </Link>
                  ),
                },
                {
                  header: 'Stage',
                  cell: (c) => {
                    const s = statusOf('greenCard', c.stage);
                    return <Chip tone={s.tone}>{s.label}</Chip>;
                  },
                },
                { header: 'Priority date', cell: (c) => <When iso={c.priorityDate} /> },
                { header: 'Stage updated', cell: (c) => <When iso={c.stageUpdatedAt} /> },
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
