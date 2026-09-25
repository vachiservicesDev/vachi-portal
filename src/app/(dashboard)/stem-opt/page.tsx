'use client';

import { useEffect, useState } from 'react';

interface Plan {
  status: string;
  employerName: string;
  selfEvaluationDueAt: string | null;
  selfEvaluationCompletedAt: string | null;
  finalEvaluationDueAt: string | null;
  finalEvaluationCompletedAt: string | null;
}

export default function StemOptPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stem-opt/me')
      .then((res) => res.json())
      .then((data) => {
        setPlan(data.plan);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">My STEM OPT Training Plan</h1>
      {!plan ? (
        <p className="mt-4 text-sm text-gray-500">No STEM OPT plan on file.</p>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-500">
            {plan.employerName} · status: {plan.status}
          </p>
          <div className="rounded-lg border border-gray-200 p-4 text-sm">
            <p>12-month self-evaluation due: {plan.selfEvaluationDueAt}</p>
            <p className="mt-1">{plan.selfEvaluationCompletedAt ? 'Completed ✓' : 'Not yet completed'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-sm">
            <p>Final evaluation due: {plan.finalEvaluationDueAt}</p>
            <p className="mt-1">{plan.finalEvaluationCompletedAt ? 'Completed ✓' : 'Not yet completed'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
