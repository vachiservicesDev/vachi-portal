'use client';

import { useEffect, useState } from 'react';

interface Summary {
  id: string;
  weekStarting: string;
  weekEnding: string;
  content: string;
  status: string;
  reviewComments: string | null;
}

export default function TrainingSummariesPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/training/summaries');
    if (res.ok) setSummaries((await res.json()).summaries);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());
    const res = await fetch('/api/training/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, submit: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to submit');
      return;
    }
    formEl.reset();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Weekly Training Summaries</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-3">
          <input name="weekStarting" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="weekEnding" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <textarea name="content" required rows={4} placeholder="What did you work on this week?" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      <ul className="mt-8 space-y-3">
        {summaries.map((s) => (
          <li key={s.id} className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium">
              {s.weekStarting} – {s.weekEnding} · {s.status}
            </p>
            <p className="mt-1 text-sm text-gray-600">{s.content}</p>
            {s.reviewComments && (
              <p className="mt-1 text-sm text-amber-600">Reviewer: {s.reviewComments}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
