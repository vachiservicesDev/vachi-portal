'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { fullName } from '@/lib/status';
import { PAF_LABELS, PafFields, PostingChip } from '@/components/paf/PafFields';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, DataTable, DateRange, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface PafFile {
  id: string;
  lcaCaseNumber: string;
  lcaFilingDate: string;
  postingStartDate: string | null;
  postingEndDate: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  visaType: string | null;
}

export default function AdminPafPage() {
  const files = useResource<{ files: PafFile[] }>('/api/paf');
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const list = files.data?.files ?? [];
  const employees = (people.data?.employees ?? [])
    .filter((e) => e.status !== 'inactive')
    .sort((a, b) => Number(b.visaType === 'H1B') - Number(a.visaType === 'H1B'));

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('create', '/api/paf', { body: formValues(form) }, 'Public access file created.');
    if (result.ok) {
      form.reset();
      files.reload();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="H-1B public access files"
        lead="One file per LCA. DOL requires the wage records and a notice posted for 10 business days before filing."
      />
      <div className="grid gap-8">
        <Panel title="Add a file">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={PAF_LABELS} />
            <SelectField
              name="employeeId"
              label="Employee"
              required
              placeholder="Choose an employee"
              options={employees.map((e) => ({ value: e.id, label: `${fullName(e.firstName, e.lastName)}${e.visaType === 'H1B' ? ' (H-1B)' : ''}` }))}
              errors={action.fieldErrors}
            />
            <PafFields errors={action.fieldErrors} />
            <div>
              <Button type="submit" busy={action.busy === 'create'} busyLabel="Saving…">
                Add file
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Files</h2>
          {files.error && <Alert title="Couldn't load files">{files.error}</Alert>}
          {files.loading && !files.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState>No public access files yet.</EmptyState>
          ) : (
            <DataTable
              caption="H-1B public access files"
              rows={list}
              rowKey={(f) => f.id}
              columns={[
                {
                  header: 'Employee',
                  primary: true,
                  cell: (f) => (
                    <Link href={`/admin/paf/${f.id}`} className="font-semibold text-navy-700 hover:underline">
                      {fullName(f.employeeFirstName, f.employeeLastName)}
                    </Link>
                  ),
                },
                { header: 'LCA case', cell: (f) => <span className="font-mono text-sm">{f.lcaCaseNumber}</span> },
                { header: 'Filed', cell: (f) => <When iso={f.lcaFilingDate} /> },
                { header: 'Notice posted', cell: (f) => (f.postingStartDate ? <DateRange from={f.postingStartDate} to={f.postingEndDate} /> : '—') },
                { header: 'Posting', cell: (f) => <PostingChip start={f.postingStartDate} end={f.postingEndDate} /> },
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
