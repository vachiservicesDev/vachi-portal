'use client';

import { useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { DueChip } from '@/components/ui/DueChip';
import { Alert, Chip, DateRange, DetailList, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Plan {
  status: string;
  employerName: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  i983SubmittedAt: string | null;
  selfEvaluationDueAt: string | null;
  selfEvaluationCompletedAt: string | null;
  finalEvaluationDueAt: string | null;
  finalEvaluationCompletedAt: string | null;
}

export default function StemOptPage() {
  const { data, error, loading } = useResource<{ plan: Plan | null }>('/api/stem-opt/me');
  const plan = data?.plan;

  return (
    <>
      <PageHeader eyebrow="Immigration" title="STEM OPT training plan" lead="Your Form I-983 plan and the two evaluations USCIS requires. HR will reach out before each one is due." />
      {error && <Alert title="Couldn't load your plan">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : !plan ? (
        <EmptyState title="No STEM OPT plan on file">If you’re on STEM OPT and expected one, message HR.</EmptyState>
      ) : (
        <div className="grid gap-8">
          <Panel title="Your plan" actions={<Chip tone={statusOf('stemOpt', plan.status).tone}>{statusOf('stemOpt', plan.status).label}</Chip>}>
            <DetailList
              items={[
                { label: 'Employer', value: plan.employerName },
                { label: 'Training period', value: <DateRange from={plan.trainingStartDate} to={plan.trainingEndDate} /> },
                { label: 'I-983 submitted', value: plan.i983SubmittedAt ? <When iso={plan.i983SubmittedAt} /> : 'Not recorded yet' },
              ]}
            />
          </Panel>
          <Panel title="Evaluations">
            <ul className="grid gap-3">
              {[
                { title: '12-month self-evaluation', due: plan.selfEvaluationDueAt, done: plan.selfEvaluationCompletedAt },
                { title: 'Final evaluation', due: plan.finalEvaluationDueAt, done: plan.finalEvaluationCompletedAt },
              ].map((ev) => (
                <li key={ev.title} className="flex flex-col gap-2 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{ev.title}</p>
                    <p className="text-sm text-muted">
                      Due <When iso={ev.due} />
                    </p>
                  </div>
                  <DueChip due={ev.due} done={ev.done} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
