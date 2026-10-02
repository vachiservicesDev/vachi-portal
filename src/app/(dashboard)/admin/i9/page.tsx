'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { SelectField } from '@/components/ui/fields';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface I9Row {
  id: string;
  employeeId: string;
  status: string;
  section2DueAt: string | null;
  everifyStatus: string;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

function todayET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export default function AdminI9Page() {
  const records = useResource<{ records: I9Row[] }>('/api/i9/records');
  const employees = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const [selected, setSelected] = useState('');
  const action = useAction();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const result = await action.run('create', '/api/i9/records', { body: { employeeId: selected } }, 'Form I-9 started. The employee can now complete Section 1 in the portal.');
    if (result.ok) {
      setSelected('');
      await records.reload();
    }
  }

  const rows = records.data?.records ?? [];
  const withI9 = new Set(rows.map((r) => r.employeeId));
  const available = (employees.data?.employees ?? []).filter((e) => !withI9.has(e.id) && e.status !== 'inactive');
  const today = todayET();

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Form I-9 and E-Verify"
        lead="Employees complete Section 1 in the portal. You complete Section 2 within 3 business days of their first day, then record the E-Verify case."
      />
      <div className="grid gap-6">
        <Panel title="Start a Form I-9">
          <form onSubmit={handleCreate} className="grid gap-4">
            <FormStatus error={action.error} success={action.success} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <SelectField
                name="employeeId"
                label="Employee"
                hideOptional
                className="flex-1"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                placeholder={available.length ? 'Choose an employee' : 'Everyone already has a Form I-9'}
                options={available.map((e) => ({ value: e.id, label: `${fullName(e.firstName, e.lastName)} (${e.email})` }))}
              />
              <Button type="submit" disabled={!selected} busy={action.busy === 'create'} busyLabel="Starting">
                Start Form I-9
              </Button>
            </div>
          </form>
        </Panel>

        {records.error && <Alert title="Couldn't load Form I-9 records">{records.error}</Alert>}
        {records.loading && !records.data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title="No Form I-9 records yet">Start one above for each new hire.</EmptyState>
        ) : (
          <DataTable
            caption="Form I-9 records"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                header: 'Employee',
                primary: true,
                cell: (r) => (
                  <Link href={`/admin/i9/${r.id}`} className="font-semibold text-navy-700 hover:underline">
                    {fullName(r.employeeFirstName, r.employeeLastName)}
                  </Link>
                ),
              },
              {
                header: 'Form I-9',
                cell: (r) => {
                  const s = statusOf('i9', r.status);
                  return <Chip tone={s.tone}>{s.label}</Chip>;
                },
              },
              {
                header: 'Section 2 due',
                cell: (r) =>
                  r.status === 'section2_pending' && r.section2DueAt ? (
                    r.section2DueAt < today ? (
                      <Chip tone="danger">
                        Overdue since <When iso={r.section2DueAt} />
                      </Chip>
                    ) : (
                      <When iso={r.section2DueAt} />
                    )
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                header: 'E-Verify',
                cell: (r) => {
                  const s = statusOf('everify', r.everifyStatus);
                  return <Chip tone={s.tone}>{s.label}</Chip>;
                },
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
