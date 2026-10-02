'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { TextField } from '@/components/ui/fields';
import { Alert, Chip, DataTable, DateRange, EmptyState, Loading, PageHeader, Panel, formatHours } from '@/components/ui/ui';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
}

/** Monday and Sunday of the current week, as YYYY-MM-DD in US Eastern time. */
function thisWeek() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export default function TimesheetsPage() {
  const router = useRouter();
  const { data, error, loading } = useResource<{ timesheets: Timesheet[] }>('/api/timesheets');
  const action = useAction();
  const week = thisWeek();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action.run<{ timesheet: Timesheet }>('create', '/api/timesheets', { body: formValues(e.currentTarget) });
    if (result.ok && result.data) router.push(`/timesheets/${result.data.timesheet.id}`);
  }

  const rows = data?.timesheets ?? [];

  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Timesheets" lead="Log the hours you work each week, then submit the week for approval." />
      <div className="grid gap-6">
        <Panel title="Start a timesheet" description="Weeks run Monday to Sunday. Change the dates if your pay period differs.">
          <form onSubmit={handleCreate} className="grid gap-4">
            <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={{ weekStarting: 'Week starting', weekEnding: 'Week ending' }} />
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField name="weekStarting" label="Week starting" type="date" required hideOptional defaultValue={week.start} errors={action.fieldErrors} />
              <TextField name="weekEnding" label="Week ending" type="date" required hideOptional defaultValue={week.end} errors={action.fieldErrors} />
              <Button type="submit" busy={action.busy === 'create'} busyLabel="Creating" className="sm:mb-0">
                Start timesheet
              </Button>
            </div>
          </form>
        </Panel>

        {error && <Alert title="Couldn't load your timesheets">{error}</Alert>}
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title="No timesheets yet">Start this week&apos;s timesheet above.</EmptyState>
        ) : (
          <DataTable
            caption="Your timesheets"
            rows={rows}
            rowKey={(t) => t.id}
            columns={[
              {
                header: 'Week',
                primary: true,
                cell: (t) => (
                  <Link href={`/timesheets/${t.id}`} className="font-semibold text-navy-700 hover:underline">
                    <DateRange from={t.weekStarting} to={t.weekEnding} />
                  </Link>
                ),
              },
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
        )}
      </div>
    </>
  );
}
