'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface I9Row {
  id: string;
  employeeId: string;
  status: string;
  section2DueAt: string | null;
  section3DueAt: string | null;
  everifyStatus: string;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function AdminI9Page() {
  const [records, setRecords] = useState<I9Row[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [recordsRes, employeesRes] = await Promise.all([
      fetch('/api/i9/records'),
      fetch('/api/employees'),
    ]);
    if (recordsRes.ok) setRecords((await recordsRes.json()).records);
    if (employeesRes.ok) setEmployees((await employeesRes.json()).employees);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!selectedEmployee) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/i9/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmployee }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'Failed to create I-9 record');
      return;
    }
    setSelectedEmployee('');
    load();
  }

  const employeeIdsWithI9 = new Set(records.map((r) => r.employeeId));
  const employeesWithoutI9 = employees.filter((e) => !employeeIdsWithI9.has(e.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">I-9 / E-Verify</h1>

      <div className="mt-6 flex gap-2">
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select an employee to start an I-9…</option>
          {employeesWithoutI9.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName} ({e.email})
            </option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          disabled={!selectedEmployee || busy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Start I-9
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {records.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {r.employeeFirstName} {r.employeeLastName}
              </p>
              <p className="text-sm text-gray-500">
                status: {r.status} · E-Verify: {r.everifyStatus}
                {isOverdue(r.section2DueAt) && r.status === 'section2_pending' && (
                  <span className="ml-2 font-medium text-red-600">Section 2 overdue</span>
                )}
              </p>
            </div>
            <Link href={`/admin/i9/${r.id}`} className="text-sm text-indigo-600 hover:underline">
              View →
            </Link>
          </li>
        ))}
        {records.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">No I-9 records yet.</li>
        )}
      </ul>
    </div>
  );
}
