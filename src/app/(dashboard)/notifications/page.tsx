'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/notifications/me');
    if (res.ok) setItems((await res.json()).notifications);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    load();
  }

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <ul className="mt-6 space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border p-4 ${n.status === 'unread' ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200'}`}
          >
            <p className="font-medium">{n.title}</p>
            <p className="mt-1 text-sm text-gray-600">{n.message}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              {n.actionUrl && (
                <Link href={n.actionUrl} className="text-indigo-600 hover:underline">
                  {n.actionLabel ?? 'View'} →
                </Link>
              )}
              {n.status === 'unread' && (
                <button onClick={() => markRead(n.id)} className="text-gray-500 hover:underline">
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-gray-500">No notifications.</li>}
      </ul>
    </div>
  );
}
