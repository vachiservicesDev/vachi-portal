'use client';

import Link from 'next/link';
import { useResource } from '@/lib/client/api';
import { TRAINING_PRIORITIES, TRAINING_TYPES, labelFrom, statusOf } from '@/lib/status';
import { LinkButton } from '@/components/ui/Button';
import { DueChip } from '@/components/ui/DueChip';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader } from '@/components/ui/ui';

interface Assignment {
  id: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  score: number | null;
  taskTitle: string;
  taskType: string;
  taskPriority: string;
  taskDueDate: string | null;
  taskIsMandatory: boolean | null;
}

function Table({ rows, caption }: { rows: Assignment[]; caption: string }) {
  return (
    <DataTable
      caption={caption}
      rows={rows}
      rowKey={(a) => a.id}
      columns={[
        {
          header: 'Training',
          primary: true,
          cell: (a) => (
            <span className="flex flex-wrap items-center gap-2">
              <Link href={`/training/${a.id}`} className="font-semibold text-navy-700 hover:underline">
                {a.taskTitle}
              </Link>
              {a.taskIsMandatory && <Chip tone="info">Required</Chip>}
            </span>
          ),
        },
        { header: 'Type', cell: (a) => labelFrom(TRAINING_TYPES, a.taskType) },
        { header: 'Priority', cell: (a) => labelFrom(TRAINING_PRIORITIES, a.taskPriority) },
        {
          header: 'Due',
          cell: (a) => (['completed', 'failed', 'expired'].includes(a.status) ? <span className="text-muted">—</span> : <DueChip due={a.taskDueDate} soonDays={7} />),
        },
        {
          header: 'Status',
          cell: (a) => {
            const s = statusOf('training', a.status);
            return <Chip tone={s.tone}>{s.label}</Chip>;
          },
        },
      ]}
    />
  );
}

export default function TrainingPage() {
  const { data, error, loading } = useResource<{ assignments: Assignment[] }>('/api/training/assignments/me');
  const all = data?.assignments ?? [];
  const open = all.filter((a) => a.status === 'assigned' || a.status === 'in_progress');
  const closed = all.filter((a) => !open.includes(a));

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Training"
        lead="Training HR has assigned to you. Open one to start it, mark it complete, or ask a question."
        actions={
          <LinkButton href="/training/summaries" variant="secondary">
            Weekly summaries
          </LinkButton>
        }
      />
      {error && <Alert title="Couldn't load your training">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : all.length === 0 ? (
        <EmptyState title="No training assigned">When HR assigns training, it shows up here and in your notifications.</EmptyState>
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-ink">
              To do <span className="font-sans text-base font-normal text-muted">({open.length})</span>
            </h2>
            {open.length === 0 ? <EmptyState>You’re all caught up.</EmptyState> : <Table rows={open} caption="Training to do" />}
          </section>
          {closed.length > 0 && (
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-ink">Finished</h2>
              <Table rows={closed} caption="Finished training" />
            </section>
          )}
        </div>
      )}
    </>
  );
}
