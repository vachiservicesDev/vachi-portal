'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
  rejectionReason: string | null;
}

interface Entry {
  id: string;
  date: string;
  hours: string;
  taskDescription: string | null;
}

export default function TimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());
    const res = await fetch(`/api/timesheets/${params.id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to add entry');
      return;
    }
    formEl.reset();
    load();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/timesheets/${params.id}/submit`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to submit');
      return;
    }
    load();
  }

  if (!timesheet) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">
        {timesheet.weekStarting} – {timesheet.weekEnding}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        status: {timesheet.status} · {timesheet.totalHours}h
      </p>
      {timesheet.rejectionReason && (
        <p className="mt-2 text-sm text-red-600">Rejected: {timesheet.rejectionReason}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>{e.date}</span>
            <span>{e.hours}h</span>
            <span className="text-gray-500">{e.taskDescription}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No entries yet.</li>}
      </ul>

      {timesheet.status === 'draft' && (
        <>
          <form onSubmit={addEntry} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <input name="date" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input name="hours" type="number" step="0.25" min="0" max="24" required placeholder="Hours" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <input name="taskDescription" placeholder="What did you work on? (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              Add entry
            </button>
          </form>

          <button onClick={submit} disabled={busy} className="mt-4 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50">
            Submit for approval
          </button>
        </>
      )}
    </div>
  );
}
