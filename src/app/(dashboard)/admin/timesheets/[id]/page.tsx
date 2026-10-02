'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { TextAreaField } from '@/components/ui/fields';
import { Alert, Chip, DateRange, Loading, PageHeader, Panel, formatHours } from '@/components/ui/ui';
import { EntryList, type Entry } from '@/components/timesheets/EntryList';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  overtimeHours: string | null;
  status: string;
  rejectionReason: string | null;
}

export default function AdminTimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ timesheet: Timesheet; entries: Entry[]; employee: { firstName: string; lastName: string } | null }>(
    `/api/timesheets/${params.id}`,
  );
  const [reason, setReason] = useState('');
  const action = useAction();

  async function review(decision: 'approved' | 'rejected') {
    const result = await action.run(
      decision,
      `/api/timesheets/${params.id}/review`,
      { method: 'PATCH', body: { decision, rejectionReason: reason.trim() || undefined } },
      decision === 'approved' ? 'Approved. The employee has been notified.' : 'Returned to the employee with your note.',
    );
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  if (!data) return <Alert title="Couldn't load this timesheet">{error}</Alert>;

  const { timesheet, entries, employee } = data;
  const st = statusOf('timesheet', timesheet.status);

  return (
    <>
      <PageHeader
        back={{ href: '/admin/timesheets', label: 'Timesheets' }}
        eyebrow={employee ? fullName(employee.firstName, employee.lastName) : undefined}
        title={<DateRange from={timesheet.weekStarting} to={timesheet.weekEnding} />}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            {formatHours(timesheet.totalHours)} total
            {Number(timesheet.overtimeHours) > 0 && <> · {formatHours(timesheet.overtimeHours)} overtime</>}
            <Chip tone={st.tone}>{st.label}</Chip>
          </span>
        }
      />
      <div className="grid gap-6">
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ rejectionReason: 'Reason' }} />
        {timesheet.status === 'rejected' && timesheet.rejectionReason && <Alert tone="info" title="Returned with this note">{timesheet.rejectionReason}</Alert>}
        <Panel title="Hours">
          <EntryList entries={entries} />
        </Panel>
        {timesheet.status === 'submitted' && (
          <Panel title="Decision">
            <div className="grid gap-5">
              <TextAreaField
                name="rejectionReason"
                label="Note to the employee"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint="Required if you return the timesheet. Say what needs fixing."
                errors={action.fieldErrors}
              />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="danger" onClick={() => review('rejected')} busy={action.busy === 'rejected'} busyLabel="Returning" disabled={!!action.busy}>
                  Return for changes
                </Button>
                <Button onClick={() => review('approved')} busy={action.busy === 'approved'} busyLabel="Approving" disabled={!!action.busy}>
                  Approve timesheet
                </Button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
