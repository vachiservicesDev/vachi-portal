'use client';

import { useParams } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { TRAINING_PRIORITIES, TRAINING_TYPES, fullName, labelFrom, statusOf } from '@/lib/status';
import { CommentThread } from '@/components/training/CommentThread';
import { Button, buttonClass } from '@/components/ui/Button';
import { DueChip } from '@/components/ui/DueChip';
import { SelectField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DetailList, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Assignment {
  id: string;
  status: string;
  score: number | null;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  timeSpentMinutes: number | null;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueDate: string | null;
  estimatedDurationMinutes: number | null;
  contentUrl: string | null;
  isMandatory: boolean | null;
}

const STATUS_OPTIONS = ['assigned', 'in_progress', 'completed', 'failed', 'expired'].map((value) => ({ value, label: statusOf('training', value).label }));

export default function TrainingAssignmentPage() {
  const params = useParams<{ id: string }>();
  const url = `/api/training/assignments/${params.id}`;
  const { data, error, loading, reload } = useResource<{ assignment: Assignment; task: Task; employee: { id: string; firstName: string; lastName: string }; viewerIsAdmin: boolean }>(url);
  const action = useAction();

  async function setStatus(status: 'in_progress' | 'completed') {
    const result = await action.run(status, url, { method: 'PATCH', body: { status } }, status === 'completed' ? 'Marked complete. Nice work.' : 'Started. Come back here to mark it complete.');
    if (result.ok) reload();
  }

  async function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { status: fd.get('status') };
    const score = String(fd.get('score') ?? '').trim();
    if (score) body.score = score;
    const result = await action.run('record', url, { method: 'PATCH', body }, 'Saved.');
    if (result.ok) reload();
  }

  if (loading && !data) return <Loading />;
  const back = { href: data?.viewerIsAdmin && data.task ? `/admin/training/${data.task.id}` : '/training', label: data?.viewerIsAdmin ? 'Back to the training task' : 'All my training' };
  if (!data) {
    return (
      <>
        <PageHeader back={{ href: '/training', label: 'All my training' }} title="Training" />
        <Alert title="Couldn't load this training">{error}</Alert>
      </>
    );
  }

  const { assignment: a, task, employee, viewerIsAdmin } = data;
  const s = statusOf('training', a.status);
  const open = a.status === 'assigned' || a.status === 'in_progress';

  return (
    <>
      <PageHeader
        back={back}
        eyebrow={viewerIsAdmin ? `Training for ${fullName(employee.firstName, employee.lastName)}` : 'Training'}
        title={task.title}
        actions={<Chip tone={s.tone}>{s.label}</Chip>}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-8">
          <Panel title="About this training">
            {task.description && <p className="mb-6 whitespace-pre-wrap text-ink-2">{task.description}</p>}
            <DetailList
              items={[
                { label: 'Type', value: labelFrom(TRAINING_TYPES, task.type) },
                { label: 'Priority', value: labelFrom(TRAINING_PRIORITIES, task.priority) },
                { label: 'Due', value: open ? <DueChip due={task.dueDate} soonDays={7} /> : <When iso={task.dueDate} /> },
                { label: 'Expected time', value: task.estimatedDurationMinutes ? `${task.estimatedDurationMinutes} minutes` : null },
                { label: 'Required', value: task.isMandatory ? 'Yes' : 'No' },
                { label: 'Score', value: a.score !== null ? `${a.score} / 100` : null },
              ]}
            />
            {task.contentUrl && (
              <a href={task.contentUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md', 'mt-6')}>
                Open the training material
                <span className="sr-only"> (opens in a new tab)</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </Panel>
          <Panel title="Questions and comments" description={viewerIsAdmin ? 'The employee is notified when you comment.' : 'HR sees what you post here.'}>
            <CommentThread assignmentId={a.id} />
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ score: 'Score', status: 'Status' }} />
          <Panel title="Progress">
            <ol className="grid gap-3 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted">Assigned</span>
                <When iso={a.assignedAt} />
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted">Started</span>
                <When iso={a.startedAt} />
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted">Completed</span>
                <When iso={a.completedAt} />
              </li>
            </ol>
            {open && !viewerIsAdmin && (
              <div className="mt-6 grid gap-3">
                {a.status === 'assigned' && (
                  <Button variant="secondary" busy={action.busy === 'in_progress'} busyLabel="Starting…" onClick={() => setStatus('in_progress')}>
                    Start training
                  </Button>
                )}
                <Button busy={action.busy === 'completed'} busyLabel="Saving…" onClick={() => setStatus('completed')}>
                  Mark complete
                </Button>
              </div>
            )}
          </Panel>
          {viewerIsAdmin && (
            <Panel title="Record a result">
              <form key={a.updatedAt} onSubmit={record} noValidate className="grid gap-5">
                <SelectField name="status" label="Status" required options={STATUS_OPTIONS} defaultValue={a.status} errors={action.fieldErrors} />
                  <TextField name="score" label="Score" type="number" inputMode="numeric" min={0} max={100} defaultValue={a.score} errors={action.fieldErrors} hint="0 to 100" />
                <div>
                  <Button type="submit" busy={action.busy === 'record'} busyLabel="Saving…">
                    Save result
                  </Button>
                </div>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
