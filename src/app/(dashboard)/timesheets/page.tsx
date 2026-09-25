'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/timesheets');
    if (res.ok) setTimesheets((await res.json()).timesheets);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());
    const res = await fetch('/api/timesheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create timesheet');
      return;
    }
    formEl.reset();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">My Timesheets</h1>

      <form onSubmit={handleCreate} className="mt-6 flex items-end gap-3 rounded-lg border border-gray-200 p-4">
        <div>
          <label className="block text-xs text-gray-500">Week starting</label>
          <input name="weekStarting" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Week ending</label>
          <input name="weekEnding" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          New timesheet
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {timesheets.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3">
            <span>
              {t.weekStarting} – {t.weekEnding}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {t.totalHours}h · {t.status}
              </span>
              <Link href={`/timesheets/${t.id}`} className="text-sm text-indigo-600 hover:underline">
                Open →
              </Link>
            </div>
          </li>
        ))}
        {timesheets.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No timesheets yet.</li>}
      </ul>
    </div>
  );
}
