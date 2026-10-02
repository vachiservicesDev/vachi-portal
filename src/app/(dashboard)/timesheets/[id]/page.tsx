'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { CheckboxField, TextField } from '@/components/ui/fields';
import { Alert, Chip, DateRange, Loading, PageHeader, Panel, formatHours } from '@/components/ui/ui';
import { EntryList, type Entry } from '@/components/timesheets/EntryList';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
  rejectionReason: string | null;
}


function TimesheetDetail() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ timesheet: Timesheet; entries: Entry[] }>(`/api/timesheets/${params.id}`);
  const action = useAction();
  const [formKey, setFormKey] = useState(0);

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action.run('add', `/api/timesheets/${params.id}/entries`, { body: formValues(e.currentTarget) });
    if (result.ok) {
      setFormKey((k) => k + 1);
      await reload();
    }
  }

  async function remove(entryId: string) {
    const result = await action.run(entryId, `/api/timesheets/${params.id}/entries?entryId=${entryId}`, { method: 'DELETE' });
    if (result.ok) await reload();
  }

  async function submit() {
    const result = await action.run('submit', `/api/timesheets/${params.id}/submit`, { method: 'POST' }, 'Submitted. HR will review it and you’ll get a notification.');
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  if (!data) return <Alert title="Couldn't load this timesheet">{error}</Alert>;

  const { timesheet, entries } = data;
  const st = statusOf('timesheet', timesheet.status);
  const editable = timesheet.status === 'draft' || timesheet.status === 'rejected';

  return (
    <>
      <PageHeader
        back={{ href: '/timesheets', label: 'Timesheets' }}
        title={<DateRange from={timesheet.weekStarting} to={timesheet.weekEnding} />}
        lead={<span className="flex flex-wrap items-center gap-2">{formatHours(timesheet.totalHours)} logged <Chip tone={st.tone}>{st.label}</Chip></span>}
      />
      <div className="grid gap-6">
        {timesheet.status === 'rejected' && timesheet.rejectionReason && (
          <Alert title="HR returned this timesheet">
            {timesheet.rejectionReason} Fix the entries below, then submit it again.
          </Alert>
        )}
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ date: 'Date', hours: 'Hours' }} />
        <Panel title="Hours">
          <EntryList entries={entries} onDelete={editable ? remove : undefined} busy={action.busy} />
        </Panel>
        {editable && (
          <Panel title="Log hours">
            <form key={formKey} onSubmit={addEntry} className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
                <TextField
                  name="date"
                  label="Date"
                  type="date"
                  required
                  min={timesheet.weekStarting}
                  max={timesheet.weekEnding}
                  defaultValue={timesheet.weekStarting}
                  errors={action.fieldErrors}
                />
                <TextField name="hours" label="Hours" type="number" inputMode="decimal" step="0.25" min="0.25" max="24" required errors={action.fieldErrors} />
              </div>
              <TextField name="taskDescription" label="What did you work on?" maxLength={2000} errors={action.fieldErrors} />
              <CheckboxField name="isOvertime" label="These are overtime hours" />
              <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
                <Button variant="secondary" onClick={submit} disabled={entries.length === 0 || !!action.busy} busy={action.busy === 'submit'} busyLabel="Submitting">
                  Submit week for approval
                </Button>
                <Button type="submit" busy={action.busy === 'add'} busyLabel="Adding">
                  Add hours
                </Button>
              </div>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}

export default TimesheetDetail;
