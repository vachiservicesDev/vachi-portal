'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PafFile {
  id: string;
  lcaCaseNumber: string;
  lcaFilingDate: string;
  postingStartDate: string | null;
  postingEndDate: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminPafPage() {
  const [files, setFiles] = useState<PafFile[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [filesRes, employeesRes] = await Promise.all([
      fetch('/api/paf'),
      fetch('/api/employees'),
    ]);
    if (filesRes.ok) setFiles((await filesRes.json()).files);
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
    const res = await fetch('/api/paf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create PAF entry');
      return;
    }
    formEl.reset();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">H-1B Public Access Files</h1>

      <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4">
        <select name="employeeId" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>
        <input name="lcaCaseNumber" required placeholder="LCA case number" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input name="worksite" required placeholder="Worksite address" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input name="lcaFilingDate" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="wageLevel" placeholder="Wage level (I-IV)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="prevailingWage" type="number" step="0.01" placeholder="Prevailing wage" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="actualWage" type="number" step="0.01" placeholder="Actual wage" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="postingStartDate" type="date" placeholder="Posting start" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="postingEndDate" type="date" placeholder="Posting end" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Add PAF entry
        </button>
      </form>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {f.employeeFirstName} {f.employeeLastName}
              </p>
              <p className="text-sm text-gray-500">
                LCA {f.lcaCaseNumber} · filed {f.lcaFilingDate}
              </p>
            </div>
            <Link href={`/admin/paf/${f.id}`} className="text-sm text-indigo-600 hover:underline">
              View →
            </Link>
          </li>
        ))}
        {files.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No PAF entries yet.</li>}
      </ul>
    </div>
  );
}
