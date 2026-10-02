'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { TRAINING_PRIORITIES, TRAINING_TYPES, fullName, labelFrom, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, DetailList, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

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

interface Assignment {
  id: string;
  employeeId: string;
  status: string;
  score: number | null;
  assignedAt: string;
  completedAt: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  department: string | null;
}

export default function AdminTrainingTaskPage() {
  const params = useParams<{ id: string }>();
  const detail = useResource<{ task: Task; assignments: Assignment[] }>(`/api/training/tasks/${params.id}`);
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const [selected, setSelected] = useState<string[]>([]);

  const assignments = detail.data?.assignments ?? [];
  const assignedIds = new Set(assignments.map((a) => a.employeeId));
  const available = (people.data?.employees ?? []).filter((e) => e.status !== 'inactive' && !assignedIds.has(e.id));

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function assign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const count = selected.length;
    const result = await action.run('assign', `/api/training/tasks/${params.id}/assign`, { body: { employeeIds: selected } }, `Assigned to ${count} ${count === 1 ? 'person' : 'people'}. They've been notified.`);
    if (result.ok) {
      setSelected([]);
      detail.reload();
    }
  }

  const back = { href: '/admin/training', label: 'All training' };
  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data)
    return (
      <>
        <PageHeader back={back} title="Training" />
        <Alert title="Couldn't load this training">{detail.error}</Alert>
      </>
    );

  const { task } = detail.data;
  const done = assignments.filter((a) => a.status === 'completed').length;

  return (
    <>
      <PageHeader back={back} eyebrow="Training" title={task.title} lead={`${done} of ${assignments.length} assigned have completed it.`} actions={task.isMandatory ? <Chip tone="info">Required</Chip> : undefined} />
      <div className="grid gap-8">
        <Panel title="Details">
          {task.description && <p className="mb-6 whitespace-pre-wrap text-ink-2">{task.description}</p>}
          <DetailList
            columns={3}
            items={[
              { label: 'Type', value: labelFrom(TRAINING_TYPES, task.type) },
              { label: 'Priority', value: labelFrom(TRAINING_PRIORITIES, task.priority) },
              { label: 'Due', value: <When iso={task.dueDate} /> },
              { label: 'Expected time', value: task.estimatedDurationMinutes ? `${task.estimatedDurationMinutes} minutes` : null },
              {
                label: 'Material',
                value: task.contentUrl ? (
                  <a href={task.contentUrl} target="_blank" rel="noopener noreferrer" className="link break-all">
                    {task.contentUrl}
                  </a>
                ) : null,
              },
            ]}
          />
        </Panel>

        <Panel title="Assign people" description="Each person gets a notification with a link to this training.">
          <form onSubmit={assign} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} />
            {people.loading && !people.data ? (
              <Loading label="Loading employees" />
            ) : available.length === 0 ? (
              <p className="text-ink-2">Every active employee is already assigned.</p>
            ) : (
              <>
                <fieldset>
                  <legend className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium text-ink">
                    Employees not yet assigned
                    <button
                      type="button"
                      className="link inline-block py-0.5 text-sm font-normal"
                      onClick={() => setSelected(selected.length === available.length ? [] : available.map((e) => e.id))}
                    >
                      {selected.length === available.length ? 'Clear all' : 'Select all'}
                    </button>
                  </legend>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {available.map((e) => (
                      <li key={e.id}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 hover:border-navy-700 has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50">
                          <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} className="h-6 w-6 shrink-0 accent-navy-700" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{fullName(e.firstName, e.lastName)}</span>
                            {e.department && <span className="block truncate text-sm text-muted">{e.department}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <div>
                  <Button type="submit" disabled={selected.length === 0} busy={action.busy === 'assign'} busyLabel="Assigning…">
                    {selected.length === 0 ? 'Choose people to assign' : `Assign to ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Assigned</h2>
          {assignments.length === 0 ? (
            <EmptyState>Nobody is assigned yet.</EmptyState>
          ) : (
            <DataTable
              caption="People assigned to this training"
              rows={assignments}
              rowKey={(a) => a.id}
              columns={[
                {
                  header: 'Employee',
                  primary: true,
                  cell: (a) => (
                    <Link href={`/training/${a.id}`} className="font-semibold text-navy-700 hover:underline">
                      {fullName(a.employeeFirstName, a.employeeLastName)}
                    </Link>
                  ),
                },
                { header: 'Assigned', cell: (a) => <When iso={a.assignedAt} /> },
                { header: 'Completed', cell: (a) => <When iso={a.completedAt} /> },
                { header: 'Score', align: 'right', cell: (a) => (a.score !== null ? `${a.score} / 100` : '—') },
                {
                  header: 'Status',
                  cell: (a) => {
                    const s = statusOf('training', a.status);
                    return <Chip tone={s.tone}>{s.label}</Chip>;
                  },
                },
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
