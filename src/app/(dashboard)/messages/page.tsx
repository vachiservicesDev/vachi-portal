'use client';

import Link from 'next/link';
import { useResource } from '@/lib/client/api';
import { partnerName } from '@/lib/messages/format';
import { Alert, EmptyState, Loading, PageHeader, formatDate } from '@/components/ui/ui';

interface Partner {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-700">
      {letters}
    </span>
  );
}

export default function MessagesPage() {
  const { data, error, loading } = useResource<{ partners: Partner[] }>('/api/messages/threads');
  const partners = data?.partners ?? [];

  return (
    <>
      <PageHeader eyebrow="Communication" title="Messages" lead="Private conversations between employees and HR." />
      {error && <Alert title="Couldn't load conversations">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : partners.length === 0 ? (
        <EmptyState title="No one to message yet">People appear here once they have a portal login.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {partners.map((p) => {
            const name = partnerName(p);
            return (
              <li key={p.id}>
                <Link href={`/messages/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5">
                  <Initials name={name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-ink ${p.unread ? 'font-semibold' : 'font-medium'}`}>
                        {name}
                        {p.role === 'admin' && <span className="t-label ml-2 text-teal-700">HR</span>}
                      </span>
                      {p.lastMessage && <span className="shrink-0 text-xs text-muted">{formatDate(p.lastMessage.createdAt)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${p.unread ? 'text-ink' : 'text-muted'}`}>
                        {p.lastMessage ? `${p.lastMessage.fromMe ? 'You: ' : ''}${p.lastMessage.body}` : 'No messages yet'}
                      </span>
                      {p.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-teal-600 px-2 text-xs font-semibold leading-5 text-white">
                          {p.unread}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
