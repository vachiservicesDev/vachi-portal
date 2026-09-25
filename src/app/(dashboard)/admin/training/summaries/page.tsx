'use client';

import { useEffect, useState } from 'react';

interface Summary {
  id: string;
  weekStarting: string;
  weekEnding: string;
  content: string;
  status: string;
  employeeFirstName: string;
  employeeLastName: string;
}

export default function AdminTrainingSummariesPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/training/summaries');
    if (res.ok) setSummaries((await res.json()).summaries);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(id);
    await fetch(`/api/training/summaries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    load();
  }

  const pending = summaries.filter((s) => s.status === 'submitted');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Weekly Summaries — Review</h1>

      <ul className="mt-6 space-y-3">
        {pending.map((s) => (
          <li key={s.id} className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium">
              {s.employeeFirstName} {s.employeeLastName} · {s.weekStarting} – {s.weekEnding}
            </p>
            <p className="mt-1 text-sm text-gray-600">{s.content}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => review(s.id, 'approved')}
                disabled={busy === s.id}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => review(s.id, 'rejected')}
                disabled={busy === s.id}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
        {pending.length === 0 && (
          <li className="text-sm text-gray-500">Nothing pending review.</li>
        )}
      </ul>
    </div>
  );
}
