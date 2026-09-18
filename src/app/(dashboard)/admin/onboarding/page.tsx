'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OnboardingSession {
  id: string;
  employmentType: 'w2' | '1099';
  status: string;
  createdAt: string;
  formData: { employeeName?: string };
}

export default function AdminOnboardingPage() {
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadSessions() {
    setLoading(true);
    const res = await fetch('/api/onboarding/sessions');
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions);
    } else {
      setError('Failed to load onboarding sessions');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());

    const res = await fetch('/api/onboarding/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'Failed to create onboarding session');
      return;
    }

    formEl.reset();
    setShowForm(false);
    loadSessions();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'New onboarding'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" required placeholder="First name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="lastName" required placeholder="Last name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <input name="employeeEmail" type="email" required placeholder="Employee email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select name="employmentType" required className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="w2">W-2</option>
              <option value="1099">1099</option>
            </select>
            <input name="startDate" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="position" placeholder="Position (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="department" placeholder="Department (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No onboarding sessions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{s.formData?.employeeName ?? 'Unknown'}</p>
                  <p className="text-sm text-gray-500">
                    {s.employmentType.toUpperCase()} · {s.status}
                  </p>
                </div>
                <Link href={`/admin/onboarding/${s.id}`} className="text-sm text-indigo-600 hover:underline">
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
