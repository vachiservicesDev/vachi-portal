'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useResource } from '@/lib/client/api';
import { statusOf, visaLabel, fullName } from '@/lib/status';
import { LinkButton } from '@/components/ui/Button';
import { inputClass, borderClass } from '@/components/ui/fields';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, When } from '@/components/ui/ui';
import { AccessChip, type EmployeeRow } from './shared';

export default function EmployeesPage() {
  const { data, error, loading } = useResource<{ employees: EmployeeRow[] }>('/api/employees');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'no-login' | 'inactive'>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.employees ?? []).filter((e) => {
      if (filter === 'no-login' && e.userId) return false;
      if (filter === 'inactive' && e.status !== 'inactive') return false;
      if (!q) return true;
      return [e.firstName, e.lastName, e.email, e.position, e.department].some((v) => v?.toLowerCase().includes(q));
    });
  }, [data, query, filter]);

  const total = data?.employees.length ?? 0;
  const noLogin = data?.employees.filter((e) => !e.userId && e.status !== 'inactive').length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        lead="Everyone on the payroll, their visa details and whether they can sign in to the portal."
        actions={<LinkButton href="/admin/employees/new">Add employee</LinkButton>}
      />

      {error && (
        <div className="mb-6">
          <Alert title="Couldn't load employees">{error}</Alert>
        </div>
      )}

      {loading && !data ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyState title="No employees yet" action={<LinkButton href="/admin/employees/new">Add your first employee</LinkButton>}>
          Add an employee here, or start their onboarding and the record is created for you.
        </EmptyState>
      ) : (
        <>
          {noLogin > 0 && (
            <div className="mb-6">
              <Alert tone="info" title={`${noLogin} ${noLogin === 1 ? 'employee doesn’t' : 'employees don’t'} have a portal login yet`}>
                Open an employee and choose <span className="font-medium text-ink">Invite to the portal</span> so they can fill in their Form I-9, log time and see pay stubs.
              </Alert>
            </div>
          )}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="employee-search" className="text-sm font-medium text-ink">
                Search
              </label>
              <input
                id="employee-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, position or department"
                className={`${inputClass} ${borderClass(false)} mt-1.5`}
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="employee-filter" className="text-sm font-medium text-ink">
                Show
              </label>
              <select
                id="employee-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className={`${inputClass} ${borderClass(false)} mt-1.5`}
              >
                <option value="all">All employees</option>
                <option value="no-login">Without a portal login</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            Showing {rows.length} of {total}
          </p>
          {rows.length === 0 ? (
            <EmptyState>No employees match that search.</EmptyState>
          ) : (
            <DataTable
              caption="Employees"
              rows={rows}
              rowKey={(r) => r.id}
              columns={[
                {
                  header: 'Name',
                  primary: true,
                  cell: (r) => (
                    <div className="min-w-0">
                      <Link href={`/admin/employees/${r.id}`} className="font-semibold text-navy-700 hover:text-navy-800 hover:underline">
                        {fullName(r.firstName, r.lastName)}
                      </Link>
                      <p className="truncate text-sm font-normal text-muted">{r.email}</p>
                    </div>
                  ),
                },
                { header: 'Role', cell: (r) => [r.position, r.department].filter(Boolean).join(', ') || <span className="text-muted">—</span> },
                {
                  header: 'Visa',
                  cell: (r) => (
                    <span>
                      {visaLabel(r.visaType)}
                      {r.visaExpiryDate && (
                        <span className="block text-sm text-muted">
                          to <When iso={r.visaExpiryDate} />
                        </span>
                      )}
                    </span>
                  ),
                },
                { header: 'Portal', cell: (r) => <AccessChip row={r} /> },
                {
                  header: 'Status',
                  cell: (r) => {
                    const s = statusOf('employee', r.status);
                    return <Chip tone={s.tone}>{s.label}</Chip>;
                  },
                },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}
