'use client';

import { useEffect, useState } from 'react';

interface Review {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: number | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goals: string | null;
  status: string;
  employeeAcknowledgedAt: string | null;
}

export default function EmployeeReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/training/reviews');
    if (res.ok) setReviews((await res.json()).reviews);
  }

  useEffect(() => {
    load();
  }, []);

  async function acknowledge(id: string) {
    setBusy(id);
    await fetch(`/api/training/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledge: true }),
    });
    setBusy(null);
    load();
  }

  const visible = reviews.filter((r) => r.status !== 'draft');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">My Performance Reviews</h1>

      <ul className="mt-6 space-y-4">
        {visible.map((r) => (
          <li key={r.id} className="rounded-lg border border-gray-200 p-4">
            <p className="font-medium">
              {r.periodStart} – {r.periodEnd}
              {r.rating && ` · ${r.rating}/5`}
            </p>
            {r.strengths && <p className="mt-2 text-sm"><span className="font-medium">Strengths:</span> {r.strengths}</p>}
            {r.areasForImprovement && <p className="mt-1 text-sm"><span className="font-medium">Areas for improvement:</span> {r.areasForImprovement}</p>}
            {r.goals && <p className="mt-1 text-sm"><span className="font-medium">Goals:</span> {r.goals}</p>}

            {r.employeeAcknowledgedAt ? (
              <p className="mt-3 text-sm text-green-600">Acknowledged ✓</p>
            ) : (
              <button
                onClick={() => acknowledge(r.id)}
                disabled={busy === r.id}
                className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="text-sm text-gray-500">No reviews yet.</li>}
      </ul>
    </div>
  );
}
