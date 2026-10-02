'use client';

import { useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DateRange, EmptyState, Loading, PageHeader, When } from '@/components/ui/ui';

interface Summary {
  id: string;
  weekStarting: string;
  weekEnding: string;
  content: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

function ReviewForm({ summary, onDone }: { summary: Summary; onDone: () => void }) {
  const action = useAction();
  const field = `reviewComments`;

  async function review(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const status = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'rejected' ? 'rejected' : 'approved';
    const reviewComments = String(new FormData(e.currentTarget).get(field) ?? '').trim();
    const result = await action.run(status, `/api/training/summaries/${summary.id}`, { method: 'PATCH', body: { status, ...(reviewComments ? { reviewComments } : {}) } });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={review} noValidate className="mt-4 grid gap-4 border-t border-line pt-4">
      <FormStatus error={action.error} />
      <TextAreaField id={`review-${summary.id}`} name={field} label="Comments for the employee" rows={3} maxLength={5000} errors={action.fieldErrors} hint="Required when you return a summary." />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="approved" busy={action.busy === 'approved'} busyLabel="Approving…">
          Approve
        </Button>
        <Button type="submit" value="rejected" variant="danger" busy={action.busy === 'rejected'} busyLabel="Returning…">
          Return for changes
        </Button>
      </div>
    </form>
  );
}

function SummaryCard({ s, children }: { s: Summary; children?: React.ReactNode }) {
  const st = statusOf('summary', s.status);
  return (
    <li className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">{fullName(s.employeeFirstName, s.employeeLastName)}</p>
          <p className="text-sm text-muted">
            Week of <DateRange from={s.weekStarting} to={s.weekEnding} />
            {s.submittedAt && (
              <>
                {' '}
                · submitted <When iso={s.submittedAt} />
              </>
            )}
          </p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-ink-2">{s.content}</p>
      {s.reviewComments && s.status !== 'submitted' && (
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-semibold">Your comments:</span> {s.reviewComments}
        </p>
      )}
      {children}
    </li>
  );
}

export default function AdminTrainingSummariesPage() {
  const { data, error, loading, reload } = useResource<{ summaries: Summary[] }>('/api/training/summaries');
  const all = data?.summaries ?? [];
  const pending = all.filter((s) => s.status === 'submitted');
  const reviewed = all.filter((s) => s.status !== 'submitted');

  return (
    <>
      <PageHeader eyebrow="Growth" title="Weekly summaries" lead="Approve each week's summary, or return it with a note on what to change. The employee is notified either way." />
      {error && <Alert title="Couldn't load summaries">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-ink">
              Awaiting review <span className="font-sans text-base font-normal text-muted">({pending.length})</span>
            </h2>
            {pending.length === 0 ? (
              <EmptyState>Nothing waiting for review.</EmptyState>
            ) : (
              <ul className="grid gap-4">
                {pending.map((s) => (
                  <SummaryCard key={s.id} s={s}>
                    <ReviewForm summary={s} onDone={reload} />
                  </SummaryCard>
                ))}
              </ul>
            )}
          </section>
          {reviewed.length > 0 && (
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-ink">Reviewed</h2>
              <ul className="grid gap-4">
                {reviewed.map((s) => (
                  <SummaryCard key={s.id} s={s} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
