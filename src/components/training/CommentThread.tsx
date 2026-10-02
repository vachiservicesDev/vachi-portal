'use client';

import { useAction, useResource } from '@/lib/client/api';
import { fullName } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Loading, When } from '@/components/ui/ui';

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorEmail: string;
  authorRole: string;
  authorFirstName: string | null;
  authorLastName: string | null;
}

/** Questions and answers on one training assignment, between the employee and HR. */
export function CommentThread({ assignmentId }: { assignmentId: string }) {
  const url = `/api/training/assignments/${assignmentId}/comments`;
  const { data, error, loading, reload } = useResource<{ comments: Comment[]; me: string }>(url);
  const action = useAction();
  const comments = data?.comments ?? [];

  async function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get('body') ?? '');
    const result = await action.run('post', url, { body: { body } });
    if (result.ok) {
      form.reset();
      reload();
    }
  }

  return (
    <div className="grid gap-5">
      {error && <Alert title="Couldn't load comments">{error}</Alert>}
      {loading && !data ? (
        <Loading label="Loading comments" />
      ) : comments.length === 0 ? (
        <p className="text-ink-2">No comments yet.</p>
      ) : (
        <ol className="grid gap-3">
          {comments.map((c) => {
            const mine = c.authorId === data?.me;
            const name = mine ? 'You' : c.authorFirstName ? fullName(c.authorFirstName, c.authorLastName) : c.authorRole === 'admin' ? 'HR' : c.authorEmail;
            return (
              <li key={c.id} className={`rounded-lg border p-4 ${mine ? 'border-navy-700/15 bg-navy-50' : 'border-line bg-white'}`}>
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-ink">{name}</span>
                  {!mine && c.authorRole === 'admin' && <span className="t-label text-teal-700">HR</span>}
                  <span className="text-muted">
                    <When iso={c.createdAt} withTime />
                  </span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-ink">{c.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={post} noValidate className="grid gap-3">
        <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={{ body: 'Comment' }} />
        <TextAreaField name="body" label="Add a comment" hideOptional rows={3} maxLength={5000} errors={action.fieldErrors} />
        <div>
          <Button type="submit" variant="secondary" busy={action.busy === 'post'} busyLabel="Posting…">
            Post comment
          </Button>
        </div>
      </form>
    </div>
  );
}
