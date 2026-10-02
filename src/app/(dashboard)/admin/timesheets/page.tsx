'use client';

import Link from 'next/link';
import { useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Alert, Chip, DataTable, DateRange, EmptyState, Loading, PageHeader, formatHours } from '@/components/ui/ui';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
  employeeFirstName: string;
  employeeLastName: string;
}

function Table({ rows, caption }: { rows: Timesheet[]; caption: string }) {
  return (
    <DataTable
      caption={caption}
      rows={rows}
      rowKey={(t) => t.id}
      columns={[
        {
          header: 'Employee',
          primary: true,
          cell: (t) => (
            <Link href={`/admin/timesheets/${t.id}`} className="font-semibold text-navy-700 hover:underline">
              {fullName(t.employeeFirstName, t.employeeLastName)}
            </Link>
          ),
        },
        { header: 'Week', cell: (t) => <DateRange from={t.weekStarting} to={t.weekEnding} /> },
        { header: 'Hours', align: 'right', cell: (t) => formatHours(t.totalHours) },
        {
          header: 'Status',
          cell: (t) => {
            const s = statusOf('timesheet', t.status);
            return <Chip tone={s.tone}>{s.label}</Chip>;
          },
        },
      ]}
    />
  );
}

export default function AdminTimesheetsPage() {
  const { data, error, loading } = useResource<{ timesheets: Timesheet[] }>('/api/timesheets');
  const all = data?.timesheets ?? [];
  const pending = all.filter((t) => t.status === 'submitted');
  const others = all.filter((t) => t.status !== 'submitted');

  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Timesheets" lead="Approve submitted weeks, or return them with a note so the employee can fix them." />
      {error && <Alert title="Couldn't load timesheets">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-ink">
              Awaiting approval <span className="font-sans text-base font-normal text-muted">({pending.length})</span>
            </h2>
            {pending.length === 0 ? <EmptyState>Nothing waiting for approval.</EmptyState> : <Table rows={pending} caption="Timesheets awaiting approval" />}
          </section>
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-ink">All other timesheets</h2>
            {others.length === 0 ? <EmptyState>No other timesheets yet.</EmptyState> : <Table rows={others} caption="Other timesheets" />}
          </section>
        </div>
      )}
    </>
  );
}
