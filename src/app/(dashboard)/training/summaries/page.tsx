'use client';

import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { todayEastern } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { FieldRow, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DateRange, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface Summary {
  id: string;
  weekStarting: string;
  weekEnding: string;
  content: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComments: string | null;
}

/** Monday and Sunday of the current week, in Eastern time. */
function thisWeek() {
  const today = new Date(`${todayEastern()}T12:00:00Z`);
  const offset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - offset * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

const LABELS = { weekStarting: 'Week starts', weekEnding: 'Week ends', content: 'Summary' };

function submitterWantsSubmit(e: React.FormEvent<HTMLFormElement>) {
  return ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'submit';
}

function EditSummary({ summary, onDone }: { summary: Summary; onDone: () => void }) {
  const action = useAction();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submit = submitterWantsSubmit(e);
    const content = String(new FormData(e.currentTarget).get('content') ?? '');
    const result = await action.run(submit ? 'submit' : 'save', `/api/training/summaries/${summary.id}`, { method: 'PATCH', body: { content, submit } });
    if (result.ok) onDone();
  }
  return (
    <form onSubmit={save} noValidate className="mt-4 grid gap-4">
      <FormStatus error={action.error} />
      <TextAreaField id={`edit-${summary.id}`} name="content" label="Summary" required rows={6} maxLength={20000} defaultValue={summary.content} errors={action.fieldErrors} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="submit" busy={action.busy === 'submit'} busyLabel="Submitting…">
          Submit for review
        </Button>
        <Button type="submit" value="save" variant="secondary" busy={action.busy === 'save'} busyLabel="Saving…">
          Save draft
        </Button>
      </div>
    </form>
  );
}

export default function TrainingSummariesPage() {
  const { data, error, loading, reload } = useResource<{ summaries: Summary[] }>('/api/training/summaries');
  const action = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const week = thisWeek();
  const list = data?.summaries ?? [];

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = submitterWantsSubmit(e);
    const fd = new FormData(form);
    const result = await action.run(
      submit ? 'submit' : 'save',
      '/api/training/summaries',
      { body: { weekStarting: fd.get('weekStarting'), weekEnding: fd.get('weekEnding'), content: String(fd.get('content') ?? ''), submit } },
      submit ? 'Summary submitted. HR will review it.' : 'Draft saved. You can finish it below.',
    );
    if (result.ok) {
      form.reset();
      reload();
    }
  }

  return (
    <>
      <PageHeader back={{ href: '/training', label: 'Training' }} eyebrow="Growth" title="Weekly summaries" lead="A short note each week on what you learned and worked on. HR reviews each one." />
      <div className="grid gap-8">
        <Panel title="Write this week's summary">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
            <FieldRow>
              <TextField name="weekStarting" label="Week starts" type="date" required defaultValue={week.start} errors={action.fieldErrors} />
              <TextField name="weekEnding" label="Week ends" type="date" required defaultValue={week.end} errors={action.fieldErrors} />
            </FieldRow>
            <TextAreaField name="content" label="Summary" required rows={6} maxLength={20000} errors={action.fieldErrors} hint="What you worked on, what you learned, and anything blocking you." />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" value="submit" busy={action.busy === 'submit'} busyLabel="Submitting…">
                Submit for review
              </Button>
              <Button type="submit" value="save" variant="secondary" busy={action.busy === 'save'} busyLabel="Saving…">
                Save draft
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Your summaries</h2>
          {error && <Alert title="Couldn't load your summaries">{error}</Alert>}
          {loading && !data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState>No summaries yet.</EmptyState>
          ) : (
            <ul className="grid gap-4">
              {list.map((s) => {
                const st = statusOf('summary', s.status);
                const editable = s.status === 'draft' || s.status === 'rejected';
                return (
                  <li key={s.id} className="rounded-lg border border-line bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-display font-semibold text-ink">
                        Week of <DateRange from={s.weekStarting} to={s.weekEnding} />
                      </p>
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </div>
                    {s.status === 'rejected' && s.reviewComments && (
                      <div className="mt-3 rounded-md border border-danger-700/25 bg-danger-50 px-4 py-3 text-sm text-ink">
                        <p className="font-semibold text-danger-700">What HR asked you to change</p>
                        <p className="mt-1 whitespace-pre-wrap">{s.reviewComments}</p>
                      </div>
                    )}
                    {s.status === 'approved' && s.reviewComments && (
                      <p className="mt-3 text-sm text-ink-2">
                        <span className="font-semibold">HR:</span> {s.reviewComments}
                      </p>
                    )}
                    {editing === s.id ? (
                      <EditSummary
                        summary={s}
                        onDone={() => {
                          setEditing(null);
                          reload();
                        }}
                      />
                    ) : (
                      <>
                        <p className="mt-3 whitespace-pre-wrap break-words text-ink-2">{s.content}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                          {s.submittedAt && (
                            <span>
                              Submitted <When iso={s.submittedAt} />
                            </span>
                          )}
                          {editable && (
                            <Button size="sm" variant="secondary" onClick={() => setEditing(s.id)}>
                              {s.status === 'rejected' ? 'Fix and resubmit' : 'Edit draft'}
                            </Button>
                          )}
                        </div>
                      </>
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
