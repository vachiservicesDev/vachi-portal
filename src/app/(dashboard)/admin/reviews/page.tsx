'use client';

import { useState } from 'react';
import { api, formValues, useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { RATING_OPTIONS, ReviewBody, type ReviewContent } from '@/components/reviews/ReviewBody';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DateRange, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Review extends ReviewContent {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  submittedAt: string | null;
  employeeAcknowledgedAt: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

const LABELS = {
  employeeId: 'Employee',
  periodStart: 'Period starts',
  periodEnd: 'Period ends',
  rating: 'Rating',
  strengths: 'Strengths',
  areasForImprovement: 'Areas for improvement',
  goals: 'Goals',
};

function wantsShare(e: React.FormEvent<HTMLFormElement>) {
  return ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'share';
}

/** Rating and the three written sections. `prefix` keeps ids unique when several forms are open. */
function ContentFields({ prefix, review, errors }: { prefix: string; review?: ReviewContent; errors: Record<string, string> }) {
  return (
    <>
      <SelectField id={`${prefix}-rating`} name="rating" label="Overall rating" placeholder="Not rated yet" options={RATING_OPTIONS} defaultValue={review?.rating ? String(review.rating) : ''} errors={errors} />
      <TextAreaField id={`${prefix}-strengths`} name="strengths" label="Strengths" rows={4} maxLength={10000} defaultValue={review?.strengths} errors={errors} />
      <TextAreaField id={`${prefix}-areas`} name="areasForImprovement" label="Areas for improvement" rows={4} maxLength={10000} defaultValue={review?.areasForImprovement} errors={errors} />
      <TextAreaField id={`${prefix}-goals`} name="goals" label="Goals for the next period" rows={4} maxLength={10000} defaultValue={review?.goals} errors={errors} />
    </>
  );
}

function contentBody(form: HTMLFormElement) {
  const fd = new FormData(form);
  const body: Record<string, unknown> = {};
  for (const key of ['strengths', 'areasForImprovement', 'goals']) body[key] = String(fd.get(key) ?? '');
  const rating = String(fd.get('rating') ?? '');
  if (rating) body.rating = Number(rating);
  return body;
}

function DraftEditor({ review, onDone }: { review: Review; onDone: () => void }) {
  const action = useAction();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const share = wantsShare(e);
    const result = await action.run(share ? 'share' : 'save', `/api/training/reviews/${review.id}`, { method: 'PATCH', body: { ...contentBody(e.currentTarget), submit: share } }, share ? undefined : 'Draft saved.');
    if (result.ok) onDone();
  }
  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <FormStatus error={action.error} success={action.success} />
      <ContentFields prefix={review.id} review={review} errors={action.fieldErrors} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="share" busy={action.busy === 'share'} busyLabel="Sharing…">
          Share with employee
        </Button>
        <Button type="submit" value="save" variant="secondary" busy={action.busy === 'save'} busyLabel="Saving…">
          Save draft
        </Button>
      </div>
    </form>
  );
}

export default function AdminReviewsPage() {
  const reviews = useResource<{ reviews: Review[] }>('/api/training/reviews');
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const list = reviews.data?.reviews ?? [];
  const employees = (people.data?.employees ?? []).filter((e) => e.status !== 'inactive');

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const share = wantsShare(e);
    const v = formValues(form);
    const result = await action.run<{ review: Review }>(
      share ? 'share' : 'save',
      '/api/training/reviews',
      { body: { ...v, ...(v.rating ? { rating: Number(v.rating) } : {}) } },
      share ? 'Review shared. The employee has been notified.' : 'Draft saved. Finish it below when you are ready to share it.',
    );
    if (!result.ok || !result.data) return;
    if (share) {
      const shared = await api(`/api/training/reviews/${result.data.review.id}`, { method: 'PATCH', body: { submit: true } });
      if (!shared.ok) {
        action.setSuccess(null);
        action.setError(`The review was saved as a draft but couldn't be shared: ${shared.message}`);
      }
    }
    form.reset();
    reviews.reload();
  }

  return (
    <>
      <PageHeader eyebrow="Growth" title="Performance reviews" lead="Write a review as a draft, then share it. Shared reviews can't be edited, and the employee is asked to acknowledge them." />
      <div className="grid gap-8">
        <Panel title="Write a review">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
            <SelectField
              name="employeeId"
              label="Employee"
              required
              placeholder="Choose an employee"
              options={employees.map((e) => ({ value: e.id, label: fullName(e.firstName, e.lastName) }))}
              errors={action.fieldErrors}
            />
            <FieldRow>
              <TextField name="periodStart" label="Period starts" type="date" required errors={action.fieldErrors} />
              <TextField name="periodEnd" label="Period ends" type="date" required errors={action.fieldErrors} />
            </FieldRow>
            <ContentFields prefix="new" errors={action.fieldErrors} />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" value="save" busy={action.busy === 'save'} busyLabel="Saving…">
                Save draft
              </Button>
              <Button type="submit" value="share" variant="secondary" busy={action.busy === 'share'} busyLabel="Sharing…">
                Save and share now
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Reviews</h2>
          {reviews.error && <Alert title="Couldn't load reviews">{reviews.error}</Alert>}
          {reviews.loading && !reviews.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState>No reviews yet.</EmptyState>
          ) : (
            <ul className="grid gap-4">
              {list.map((r) => {
                const s = statusOf('review', r.status);
                const expanded = open === r.id;
                return (
                  <li key={r.id} className="rounded-lg border border-line bg-white">
                    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink">{fullName(r.employeeFirstName, r.employeeLastName)}</p>
                        <p className="text-sm text-muted">
                          <DateRange from={r.periodStart} to={r.periodEnd} />
                          {r.employeeAcknowledgedAt && (
                            <>
                              {' '}
                              · acknowledged <When iso={r.employeeAcknowledgedAt} />
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Chip tone={s.tone}>{s.label}</Chip>
                        <Button size="sm" variant="secondary" aria-expanded={expanded} aria-controls={`review-${r.id}`} onClick={() => setOpen(expanded ? null : r.id)}>
                          {expanded ? 'Close' : r.status === 'draft' ? 'Edit draft' : 'View'}
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <div id={`review-${r.id}`} className="border-t border-line p-5">
                        {r.status === 'draft' ? (
                          <DraftEditor
                            review={r}
                            onDone={() => {
                              reviews.reload();
                            }}
                          />
                        ) : (
                          <ReviewBody review={r} />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
