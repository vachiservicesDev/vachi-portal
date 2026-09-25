'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Plan {
  id: string;
  status: string;
  selfEvaluationDueAt: string | null;
  finalEvaluationDueAt: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminStemOptPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [plansRes, employeesRes] = await Promise.all([
      fetch('/api/stem-opt'),
      fetch('/api/employees'),
    ]);
    if (plansRes.ok) setPlans((await plansRes.json()).plans);
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
    const res = await fetch('/api/stem-opt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create plan');
      return;
    }
    formEl.reset();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">STEM OPT Training Plans (Form I-983)</h1>

      <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4">
        <select name="employeeId" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>
        <input name="employerName" required placeholder="Employer name" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input name="trainingStartDate" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="trainingEndDate" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Create plan
        </button>
      </form>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {p.employeeFirstName} {p.employeeLastName}
              </p>
              <p className="text-sm text-gray-500">
                {p.status} · self-eval due {p.selfEvaluationDueAt} · final due {p.finalEvaluationDueAt}
              </p>
            </div>
            <Link href={`/admin/stem-opt/${p.id}`} className="text-sm text-indigo-600 hover:underline">
              Manage →
            </Link>
          </li>
        ))}
        {plans.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No STEM OPT plans yet.</li>}
      </ul>
    </div>
  );
}
