'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface GcCase {
  id: string;
  stage: string;
  priorityDate: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminGreenCardPage() {
  const [cases, setCases] = useState<GcCase[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [casesRes, employeesRes] = await Promise.all([
      fetch('/api/green-card'),
      fetch('/api/employees'),
    ]);
    if (casesRes.ok) setCases((await casesRes.json()).cases);
    if (employeesRes.ok) setEmployees((await employeesRes.json()).employees);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!selectedEmployee) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/green-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmployee }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to start case');
      return;
    }
    setSelectedEmployee('');
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Green Card Sponsorship</h1>

      <div className="mt-6 flex gap-2">
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select employee to start a case…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>
        <button onClick={handleCreate} disabled={!selectedEmployee || busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Start case
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {cases.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {c.employeeFirstName} {c.employeeLastName}
              </p>
              <p className="text-sm text-gray-500">
                {c.stage}
                {c.priorityDate && ` · priority date ${c.priorityDate}`}
              </p>
            </div>
            <Link href={`/admin/green-card/${c.id}`} className="text-sm text-indigo-600 hover:underline">
              Manage →
            </Link>
          </li>
        ))}
        {cases.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No cases yet.</li>}
      </ul>
    </div>
  );
}
