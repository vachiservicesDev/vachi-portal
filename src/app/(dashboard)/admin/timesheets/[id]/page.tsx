'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
}

interface Entry {
  id: string;
  date: string;
  hours: string;
  taskDescription: string | null;
}

export default function AdminTimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/timesheets/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setTimesheet(data.timesheet);
      setEntries(data.entries);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.id only
  }, [params.id]);

  async function review(decision: 'approved' | 'rejected') {
    setBusy(true);
    await fetch(`/api/timesheets/${params.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, rejectionReason: reason || undefined }),
    });
    setBusy(false);
    load();
  }

  if (!timesheet) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">
        {timesheet.weekStarting} – {timesheet.weekEnding}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        status: {timesheet.status} · {timesheet.totalHours}h total
      </p>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>{e.date}</span>
            <span>{e.hours}h</span>
            <span className="text-gray-500">{e.taskDescription}</span>
          </li>
        ))}
      </ul>

      {timesheet.status === 'submitted' && (
        <div className="mt-6 space-y-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (if rejecting)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={() => review('approved')} disabled={busy} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50">
              Approve
            </button>
            <button onClick={() => review('rejected')} disabled={busy} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
