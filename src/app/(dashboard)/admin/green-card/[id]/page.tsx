'use client';

import { useParams } from 'next/navigation';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { GREEN_CARD_STAGES, fullName, statusOf } from '@/lib/status';
import { StageTracker } from '@/components/immigration/StageTracker';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface GcCase {
  id: string;
  stage: string;
  priorityDate: string | null;
  notes: string | null;
  stageUpdatedAt: string;
  employeeFirstName: string;
  employeeLastName: string;
  employeeEmail: string;
}

export default function AdminGreenCardDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ case: GcCase }>(`/api/green-card/${params.id}`);
  const action = useAction();
  const gc = data?.case;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Send empty values too, so clearing the priority date or notes sticks.
    const body = { ...formValues(e.currentTarget), priorityDate: String(fd.get('priorityDate') ?? ''), notes: String(fd.get('notes') ?? '') };
    const result = await action.run('save', `/api/green-card/${params.id}`, { method: 'PATCH', body }, 'Case updated.');
    if (result.ok) reload();
  }

  const back = { href: '/admin/green-card', label: 'All green card cases' };
  if (loading && !data) return <Loading />;
  if (!gc) return (
    <>
      <PageHeader back={back} title="Green card case" />
      <Alert title="Couldn't load this case">{error}</Alert>
    </>
  );

  const s = statusOf('greenCard', gc.stage);
  return (
    <>
      <PageHeader back={back} eyebrow="Green card case" title={fullName(gc.employeeFirstName, gc.employeeLastName)} lead={gc.employeeEmail} actions={<Chip tone={s.tone}>{s.label}</Chip>} />
      <div className="grid gap-8">
        <Panel title="Progress" description={<>Stage last changed <When iso={gc.stageUpdatedAt} />.</>}>
          <StageTracker stage={gc.stage} />
        </Panel>
        <Panel title="Update the case">
          <form key={gc.stageUpdatedAt + (gc.priorityDate ?? '') + (gc.notes ?? '')} onSubmit={save} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ stage: 'Stage', priorityDate: 'Priority date', notes: 'Notes' }} />
            <FieldRow>
              <SelectField name="stage" label="Stage" required options={GREEN_CARD_STAGES} defaultValue={gc.stage} errors={action.fieldErrors} />
              <TextField name="priorityDate" label="Priority date" type="date" defaultValue={gc.priorityDate} errors={action.fieldErrors} />
            </FieldRow>
            <TextAreaField name="notes" label="Internal notes" defaultValue={gc.notes} maxLength={5000} errors={action.fieldErrors} hint="Only HR sees these." />
            <div>
              <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving…">
                Save changes
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
