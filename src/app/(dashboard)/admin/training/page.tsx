'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { TRAINING_PRIORITIES, TRAINING_TYPES, labelFrom } from '@/lib/status';
import { Button, LinkButton } from '@/components/ui/Button';
import { CheckboxField, FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: string | null;
  isMandatory: boolean | null;
  assignedCount: number;
  completedCount: number;
}

const LABELS = {
  title: 'Title',
  description: 'Description',
  type: 'Type',
  priority: 'Priority',
  dueDate: 'Due date',
  estimatedDurationMinutes: 'Expected time',
  contentUrl: 'Link to material',
};

export default function AdminTrainingPage() {
  const { data, error, loading, reload } = useResource<{ tasks: Task[] }>('/api/training/tasks');
  const action = useAction();
  const tasks = data?.tasks ?? [];

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run<{ task: Task }>('create', '/api/training/tasks', { body: formValues(form) }, 'Training created. Open it to assign people.');
    if (result.ok) {
      form.reset();
      reload();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Training"
        lead="Create training, then open it to assign employees and follow their progress."
        actions={
          <LinkButton href="/admin/training/summaries" variant="secondary">
            Weekly summaries
          </LinkButton>
        }
      />
      <div className="grid gap-8">
        <Panel title="Create training">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
            <TextField name="title" label="Title" required maxLength={255} errors={action.fieldErrors} />
            <TextAreaField name="description" label="Description" rows={3} maxLength={10000} errors={action.fieldErrors} />
            <FieldRow>
              <SelectField name="type" label="Type" required options={TRAINING_TYPES} defaultValue="general" errors={action.fieldErrors} />
              <SelectField name="priority" label="Priority" required options={TRAINING_PRIORITIES} defaultValue="medium" errors={action.fieldErrors} />
            </FieldRow>
            <FieldRow>
              <TextField name="dueDate" label="Due date" type="date" errors={action.fieldErrors} />
              <TextField name="estimatedDurationMinutes" label="Expected time (minutes)" type="number" inputMode="numeric" min={1} errors={action.fieldErrors} />
            </FieldRow>
            <TextField name="contentUrl" label="Link to material" type="url" placeholder="https://" errors={action.fieldErrors} hint="A doc, video or course people should open." />
            <CheckboxField name="isMandatory" label="Required for everyone assigned" />
            <div>
              <Button type="submit" busy={action.busy === 'create'} busyLabel="Creating…">
                Create training
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">All training</h2>
          {error && <Alert title="Couldn't load training">{error}</Alert>}
          {loading && !data ? (
            <Loading />
          ) : tasks.length === 0 ? (
            <EmptyState>No training yet. Create the first one above.</EmptyState>
          ) : (
            <DataTable
              caption="Training"
              rows={tasks}
              rowKey={(t) => t.id}
              columns={[
                {
                  header: 'Training',
                  primary: true,
                  cell: (t) => (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/training/${t.id}`} className="font-semibold text-navy-700 hover:underline">
                        {t.title}
                      </Link>
                      {t.isMandatory && <Chip tone="info">Required</Chip>}
                    </span>
                  ),
                },
                { header: 'Type', cell: (t) => labelFrom(TRAINING_TYPES, t.type) },
                { header: 'Priority', cell: (t) => labelFrom(TRAINING_PRIORITIES, t.priority) },
                { header: 'Due', cell: (t) => <When iso={t.dueDate} /> },
                { header: 'Done', align: 'right', cell: (t) => `${t.completedCount} of ${t.assignedCount}` },
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
