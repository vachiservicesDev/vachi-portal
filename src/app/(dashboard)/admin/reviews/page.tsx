'use client';

import { useEffect, useState } from 'react';

interface Review {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: number | null;
  status: string;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [reviewsRes, employeesRes] = await Promise.all([
      fetch('/api/training/reviews'),
      fetch('/api/employees'),
    ]);
    if (reviewsRes.ok) setReviews((await reviewsRes.json()).reviews);
    if (employeesRes.ok) setEmployees((await employeesRes.json()).employees);
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
    const res = await fetch('/api/training/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create review');
      return;
    }
    formEl.reset();
    load();
  }

  async function submitReview(id: string) {
    setBusy(true);
    await fetch(`/api/training/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submit: true }),
    });
    setBusy(false);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Performance Reviews</h1>

      <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-6">
        <select name="employeeId" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input name="periodStart" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="periodEnd" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <select name="rating" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Rating (optional)</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <textarea name="strengths" placeholder="Strengths" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <textarea name="areasForImprovement" placeholder="Areas for improvement" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <textarea name="goals" placeholder="Goals" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save draft'}
        </button>
      </form>

      <ul className="mt-8 space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium">
                {r.employeeFirstName} {r.employeeLastName}
              </p>
              <p className="text-sm text-gray-500">
                {r.periodStart} – {r.periodEnd} · {r.status}
                {r.rating && ` · rating ${r.rating}/5`}
              </p>
            </div>
            {r.status === 'draft' && (
              <button onClick={() => submitReview(r.id)} disabled={busy} className="text-sm text-indigo-600 hover:underline">
                Submit to employee →
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
