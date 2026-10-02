'use client';

import { useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { ReviewBody, type ReviewContent } from '@/components/reviews/ReviewBody';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DateRange, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Review extends ReviewContent {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  submittedAt: string | null;
  employeeAcknowledgedAt: string | null;
}

export default function ReviewsPage() {
  const { data, error, loading, reload } = useResource<{ reviews: Review[] }>('/api/training/reviews');
  const action = useAction();
  const reviews = data?.reviews ?? [];

  async function acknowledge(id: string) {
    const result = await action.run(id, `/api/training/reviews/${id}`, { method: 'PATCH', body: { acknowledge: true } }, 'Thanks. HR can see you’ve read your review.');
    if (result.ok) reload();
  }

  return (
    <>
      <PageHeader eyebrow="Growth" title="Performance reviews" lead="Reviews HR has shared with you. Acknowledging one tells HR you've read it; it doesn't mean you agree with every point." />
      {error && <Alert title="Couldn't load your reviews">{error}</Alert>}
      <div className="grid gap-6">
        <FormStatus error={action.error} success={action.success} />
        {loading && !data ? (
          <Loading />
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet">You’ll get a notification when HR shares one.</EmptyState>
        ) : (
          reviews.map((r) => {
            const s = statusOf('review', r.status);
            return (
              <Panel
                key={r.id}
                title={
                  <>
                    Review for <DateRange from={r.periodStart} to={r.periodEnd} />
                  </>
                }
                description={
                  r.submittedAt ? (
                    <>
                      Shared <When iso={r.submittedAt} />
                    </>
                  ) : undefined
                }
                actions={<Chip tone={s.tone}>{s.label}</Chip>}
              >
                <ReviewBody review={r} />
                <div className="mt-6 border-t border-line pt-5">
                  {r.employeeAcknowledgedAt ? (
                    <p className="text-sm text-ink-2">
                      You acknowledged this review on <When iso={r.employeeAcknowledgedAt} />.
                    </p>
                  ) : (
                    <Button busy={action.busy === r.id} busyLabel="Saving…" onClick={() => acknowledge(r.id)}>
                      I’ve read this review
                    </Button>
                  )}
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </>
  );
}
