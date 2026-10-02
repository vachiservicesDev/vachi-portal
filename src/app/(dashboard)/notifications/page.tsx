'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, EmptyState, Loading, PageHeader, When } from '@/components/ui/ui';

interface Notification {
  id: string;
  title: string;
  message: string;
  status: string;
  priority: string;
  actionUrl: string | null;
  actionLabel: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data, error, loading, setData } = useResource<{ notifications: Notification[] }>('/api/notifications/me');
  const action = useAction();
  const items = data?.notifications ?? [];
  const unread = items.filter((n) => n.status === 'unread').length;

  function markLocally(ids: string[] | 'all') {
    setData((d) => (d ? { notifications: d.notifications.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, status: 'read' } : n)) } : d));
    // The unread badge in the top bar comes from the server.
    router.refresh();
  }

  async function markRead(id: string) {
    const result = await action.run(id, `/api/notifications/${id}/read`, { method: 'POST' });
    if (result.ok) markLocally([id]);
  }

  async function markAll() {
    const result = await action.run('all', '/api/notifications/read-all', { method: 'POST' });
    if (result.ok) markLocally('all');
  }

  async function open(n: Notification) {
    if (n.status === 'unread') await action.run(n.id, `/api/notifications/${n.id}/read`, { method: 'POST' });
    if (n.actionUrl) router.push(n.actionUrl);
  }

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notifications"
        lead={unread ? `${unread} unread.` : 'You’re all caught up.'}
        actions={
          unread > 0 ? (
            <Button variant="secondary" busy={action.busy === 'all'} busyLabel="Marking…" onClick={markAll}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {error && <Alert title="Couldn't load notifications">{error}</Alert>}
      <FormStatus error={action.error} />
      {loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications">Assignments, reviews and returned timesheets show up here.</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((n) => {
            const isUnread = n.status === 'unread';
            return (
              <li key={n.id} className={`rounded-lg border p-4 sm:p-5 ${isUnread ? 'border-navy-700/25 bg-navy-50' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <p className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                    {isUnread && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                    <span className="min-w-0 break-words">{n.title}</span>
                    {isUnread && <span className="sr-only">(unread)</span>}
                  </p>
                  <span className="text-sm text-muted">
                    <When iso={n.createdAt} withTime />
                  </span>
                </div>
                <p className="mt-1 break-words text-ink-2">{n.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {(n.priority === 'high' || n.priority === 'critical') && <Chip tone={n.priority === 'critical' ? 'danger' : 'warning'}>{n.priority === 'critical' ? 'Urgent' : 'Important'}</Chip>}
                  {n.actionUrl && (
                    <Button size="sm" onClick={() => open(n)}>
                      {n.actionLabel ?? 'Open'}
                    </Button>
                  )}
                  {isUnread && (
                    <Button size="sm" variant="ghost" busy={action.busy === n.id} busyLabel="Marking…" onClick={() => markRead(n.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-sm text-muted">
        Looking for a conversation? <Link href="/messages" className="link">Go to messages</Link>.
      </p>
    </>
  );
}
