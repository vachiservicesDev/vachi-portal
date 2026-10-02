'use client';

import { useParams } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { DueChip } from '@/components/ui/DueChip';
import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DateRange, DetailList, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Plan {
  id: string;
  status: string;
  employerName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  i983SubmittedAt: string | null;
  selfEvaluationDueAt: string | null;
  selfEvaluationCompletedAt: string | null;
  finalEvaluationDueAt: string | null;
  finalEvaluationCompletedAt: string | null;
  notes: string | null;
  updatedAt: string;
  employeeFirstName: string;
  employeeLastName: string;
  employeeEmail: string;
}

const STATUS_OPTIONS = ['active', 'evaluation_due', 'completed', 'terminated'].map((value) => ({ value, label: statusOf('stemOpt', value).label }));

function Evaluation({
  title,
  due,
  done,
  busy,
  onComplete,
}: {
  title: string;
  due: string | null;
  done: string | null;
  busy: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-muted">
          Due <When iso={due} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DueChip due={due} done={done} />
        {!done && (
          <Button size="sm" variant="secondary" busy={busy} busyLabel="Saving…" onClick={onComplete}>
            Mark complete
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminStemOptDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ plan: Plan }>(`/api/stem-opt/${params.id}`);
  const action = useAction();
  const plan = data?.plan;
  const url = `/api/stem-opt/${params.id}`;

  async function patch(key: string, body: Record<string, unknown>, message: string) {
    const result = await action.run(key, url, { method: 'PATCH', body }, message);
    if (result.ok) reload();
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await patch('save', { status: fd.get('status'), i983SubmittedAt: String(fd.get('i983SubmittedAt') ?? ''), notes: String(fd.get('notes') ?? '') }, 'Plan updated.');
  }

  const back = { href: '/admin/stem-opt', label: 'All STEM OPT plans' };
  if (loading && !data) return <Loading />;
  if (!plan)
    return (
      <>
        <PageHeader back={back} title="STEM OPT plan" />
        <Alert title="Couldn't load this plan">{error}</Alert>
      </>
    );

  const s = statusOf('stemOpt', plan.status);
  return (
    <>
      <PageHeader back={back} eyebrow="STEM OPT plan" title={fullName(plan.employeeFirstName, plan.employeeLastName)} lead={plan.employeeEmail} actions={<Chip tone={s.tone}>{s.label}</Chip>} />
      <div className="grid gap-8">
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ status: 'Status', i983SubmittedAt: 'I-983 submitted', notes: 'Notes' }} />
        <Panel title="Plan">
          <DetailList
            items={[
              { label: 'Employer', value: plan.employerName },
              { label: 'Training period', value: <DateRange from={plan.trainingStartDate} to={plan.trainingEndDate} /> },
              { label: 'I-983 submitted', value: plan.i983SubmittedAt ? <When iso={plan.i983SubmittedAt} /> : 'Not recorded' },
            ]}
          />
        </Panel>
        <Panel title="Evaluations" description="USCIS requires both. Marking the final one complete also completes the plan.">
          <div className="grid gap-3">
            <Evaluation
              title="12-month self-evaluation"
              due={plan.selfEvaluationDueAt}
              done={plan.selfEvaluationCompletedAt}
              busy={action.busy === 'self'}
              onComplete={() => patch('self', { selfEvaluationCompletedAt: true }, '12-month evaluation marked complete.')}
            />
            <Evaluation
              title="Final evaluation"
              due={plan.finalEvaluationDueAt}
              done={plan.finalEvaluationCompletedAt}
              busy={action.busy === 'final'}
              onComplete={() => patch('final', { finalEvaluationCompletedAt: true }, 'Final evaluation marked complete. The plan is now completed.')}
            />
          </div>
        </Panel>
        <Panel title="Update the plan">
          <form key={plan.updatedAt} onSubmit={save} noValidate className="grid gap-5">
            <FieldRow>
              <SelectField name="status" label="Status" required options={STATUS_OPTIONS} defaultValue={plan.status} errors={action.fieldErrors} />
              <TextField name="i983SubmittedAt" label="I-983 submitted" type="date" defaultValue={plan.i983SubmittedAt} errors={action.fieldErrors} />
            </FieldRow>
            <TextAreaField name="notes" label="Internal notes" defaultValue={plan.notes} maxLength={5000} errors={action.fieldErrors} hint="Only HR sees these." />
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
