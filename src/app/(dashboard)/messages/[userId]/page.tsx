'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}

export default function ConversationPage() {
  const params = useParams<{ userId: string }>();
  const supabase = createClient();
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/messages/${params.userId}`);
    if (res.ok) setMessages((await res.json()).messages);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.userId only
  }, [params.userId]);

  // Live delivery via Supabase Realtime, RLS-scoped to messages where I'm
  // sender or recipient (see supabase/rls-policies.sql) - this is the one
  // place in the app where RLS is the actual enforcement, not
  // defense-in-depth, since Realtime only ever goes through the anon-key
  // client.
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`messages:${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
            body: string;
            created_at: string;
          };
          const involvesThisThread =
            (row.sender_id === myId && row.recipient_id === params.userId) ||
            (row.sender_id === params.userId && row.recipient_id === myId);
          if (!involvesThisThread) return;

          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    senderId: row.sender_id,
                    recipientId: row.recipient_id,
                    body: row.body,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable; re-subscribe only on identity change
  }, [myId, params.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/messages/${params.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    setBusy(false);
    if (res.ok) {
      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setDraft('');
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-2xl flex-col px-4 py-6">
      <h1 className="text-xl font-semibold">Conversation</h1>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-4">
        {messages.map((m) => (
          <div key={m.id} className={m.senderId === myId ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-xs rounded-lg px-3 py-2 text-sm ${
                m.senderId === myId ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.body}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button onClick={send} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
