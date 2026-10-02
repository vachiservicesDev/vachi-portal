'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api, useResource } from '@/lib/client/api';
import { partnerName } from '@/lib/messages/format';
import { Button } from '@/components/ui/Button';
import { inputClass, borderClass } from '@/components/ui/fields';
import { Alert, Loading, PageHeader, formatDate } from '@/components/ui/ui';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}

interface Partner {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
}

const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

export default function ConversationPage() {
  const params = useParams<{ userId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { data, error, loading, setData, reload } = useResource<{ messages: Message[]; partner: Partner; me: string }>(`/api/messages/${params.userId}`);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const myId = data?.me ?? null;
  const messages = data?.messages ?? [];

  function append(m: Message) {
    setData((d) => (d && !d.messages.some((x) => x.id === m.id) ? { ...d, messages: [...d.messages, m] } : d));
  }

  // Live delivery via Supabase Realtime, RLS-scoped to messages where I'm sender or recipient
  // (see supabase/rls-policies.sql). Needs `messages` in the supabase_realtime publication.
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`messages:${myId}:${params.userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };
        const inThread = (row.sender_id === myId && row.recipient_id === params.userId) || (row.sender_id === params.userId && row.recipient_id === myId);
        if (inThread) append({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id, body: row.body, createdAt: row.created_at });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-subscribe only when the people change
  }, [myId, params.userId, supabase]);

  // A slow refresh as a safety net in case the live connection drops.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 20_000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    const result = await api<{ message: Message }>(`/api/messages/${params.userId}`, { body: { body } });
    setSending(false);
    if (result.ok && result.data) {
      append(result.data.message);
      setDraft('');
    } else {
      setSendError(result.fieldErrors.body ?? result.message);
    }
  }

  const back = { href: '/messages', label: 'All conversations' };
  if (loading && !data) return <Loading />;
  if (!data)
    return (
      <>
        <PageHeader back={back} title="Conversation" />
        <Alert title="Couldn't open this conversation">{error}</Alert>
      </>
    );

  const name = partnerName(data.partner);
  let lastDay = '';

  return (
    <>
      <PageHeader back={back} eyebrow={data.partner.role === 'admin' ? 'HR' : 'Employee'} title={name} lead={data.partner.firstName ? data.partner.email : undefined} />
      <section aria-label={`Conversation with ${name}`} className="flex h-[min(68dvh,44rem)] min-h-[22rem] flex-col rounded-lg border border-line bg-white">
        <div ref={listRef} role="log" aria-live="polite" aria-label="Messages" className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-muted">No messages yet. Say hello.</p>
          ) : (
            <ol className="grid gap-2">
              {messages.map((m) => {
                const mine = m.senderId === myId;
                const day = formatDate(m.createdAt);
                const showDay = day !== lastDay;
                lastDay = day;
                return (
                  <li key={m.id} className="grid gap-2">
                    {showDay && <p className="t-label py-2 text-center text-muted">{day}</p>}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3.5 py-2 sm:max-w-[70%] ${mine ? 'rounded-br-sm bg-navy-700 text-white' : 'rounded-bl-sm bg-subtle text-ink'}`}>
                        <span className="sr-only">{mine ? 'You' : name}: </span>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-right text-xs ${mine ? 'text-white/75' : 'text-muted'}`}>
                          <time dateTime={m.createdAt}>{timeFmt.format(new Date(m.createdAt))}</time>
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {data.partner.isActive ? (
          <form onSubmit={send} className="border-t border-line p-3 sm:p-4">
            {sendError && (
              <p role="alert" className="mb-2 text-sm font-medium text-danger-700">
                {sendError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <label htmlFor="f-message" className="sr-only">
                Message {name}
              </label>
              <textarea
                id="f-message"
                rows={1}
                value={draft}
                maxLength={5000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Write a message"
                className={`${inputClass} ${borderClass(false)} max-h-40 min-h-12 flex-1 resize-none`}
              />
              <Button type="submit" busy={sending} busyLabel="Sending" disabled={!draft.trim()} className="min-h-12">
                Send
              </Button>
            </div>
            <p className="mt-1.5 hidden text-xs text-muted sm:block">Enter to send, Shift+Enter for a new line.</p>
          </form>
        ) : (
          <p className="border-t border-line p-4 text-sm text-muted">{name} no longer has portal access, so you can’t send new messages.</p>
        )}
      </section>
    </>
  );
}
