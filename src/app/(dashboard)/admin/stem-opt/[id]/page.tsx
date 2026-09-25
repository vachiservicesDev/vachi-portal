'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Plan {
  id: string;
  status: string;
  employerName: string;
  i983SubmittedAt: string | null;
  selfEvaluationDueAt: string | null;
  selfEvaluationCompletedAt: string | null;
  finalEvaluationDueAt: string | null;
  finalEvaluationCompletedAt: string | null;
  notes: string | null;
}

export default function AdminStemOptDetailPage() {
  const params = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/stem-opt/${params.id}`);
    if (res.ok) setPlan((await res.json()).plan);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.id only
  }, [params.id]);

  async function markComplete(field: 'selfEvaluationCompletedAt' | 'finalEvaluationCompletedAt') {
    setBusy(true);
    await fetch(`/api/stem-opt/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: true }),
    });
    setBusy(false);
    load();
  }

  if (!plan) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">STEM OPT Plan — {plan.employerName}</h1>
      <p className="mt-1 text-sm text-gray-500">status: {plan.status}</p>

      <section className="mt-6 rounded-lg border border-gray-200 p-4">
        <p className="text-sm">12-month self-evaluation due: {plan.selfEvaluationDueAt}</p>
        {plan.selfEvaluationCompletedAt ? (
          <p className="mt-1 text-sm text-green-600">Completed ✓</p>
        ) : (
          <button onClick={() => markComplete('selfEvaluationCompletedAt')} disabled={busy} className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Mark self-evaluation complete
          </button>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 p-4">
        <p className="text-sm">Final evaluation due: {plan.finalEvaluationDueAt}</p>
        {plan.finalEvaluationCompletedAt ? (
          <p className="mt-1 text-sm text-green-600">Completed ✓</p>
        ) : (
          <button onClick={() => markComplete('finalEvaluationCompletedAt')} disabled={busy} className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Mark final evaluation complete
          </button>
        )}
      </section>
    </div>
  );
}
