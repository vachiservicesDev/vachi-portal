'use client';

import { useEffect, useState } from 'react';

interface PayRun {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  status: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Stub {
  id: string;
  grossPay: string;
  netPay: string;
  employeeFirstName: string;
  employeeLastName: string;
}

export default function AdminPayrollPage() {
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [stubs, setStubs] = useState<Stub[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns() {
    const res = await fetch('/api/payroll/runs');
    if (res.ok) setRuns((await res.json()).runs);
  }

  async function loadRunDetail(id: string) {
    const res = await fetch(`/api/payroll/runs/${id}`);
    if (res.ok) setStubs((await res.json()).stubs);
  }

  useEffect(() => {
    loadRuns();
    fetch('/api/employees')
      .then((res) => res.json())
      .then((data) => setEmployees(data.employees));
  }, []);

  useEffect(() => {
    if (selectedRun) loadRunDetail(selectedRun);
  }, [selectedRun]);

  async function createRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());
    const res = await fetch('/api/payroll/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create pay run');
      return;
    }
    formEl.reset();
    loadRuns();
  }

  async function addStub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedRun) return;
    setBusy(true);
    setError(null);
    const formEl = e.currentTarget;
    const data = Object.fromEntries(new FormData(formEl).entries());
    const res = await fetch(`/api/payroll/runs/${selectedRun}/stubs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to add pay stub');
      return;
    }
    formEl.reset();
    loadRunDetail(selectedRun);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Payroll</h1>
      <p className="mt-1 text-sm text-gray-500">
        No payroll provider is wired up yet (vendor still open — see docs/PLAN.md). Record pay
        runs here after processing payroll through whatever you currently use.
      </p>

      <form onSubmit={createRun} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-3">
          <input name="payPeriodStart" type="date" required placeholder="Period start" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="payPeriodEnd" type="date" required placeholder="Period end" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="payDate" type="date" required placeholder="Pay date" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Create pay run
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {runs.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => setSelectedRun(r.id === selectedRun ? null : r.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              <span>
                {r.payPeriodStart} – {r.payPeriodEnd} (pay date {r.payDate})
              </span>
              <span className="text-gray-500">{r.status}</span>
            </button>
            {selectedRun === r.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4">
                <form onSubmit={addStub} className="flex flex-wrap items-end gap-2">
                  <select name="employeeId" required className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Employee…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </option>
                    ))}
                  </select>
                  <input name="grossPay" type="number" step="0.01" min="0" required placeholder="Gross pay" className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <input name="netPay" type="number" step="0.01" min="0" required placeholder="Net pay" className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                    Add stub
                  </button>
                </form>
                <ul className="mt-3 space-y-1 text-sm">
                  {stubs.map((s) => (
                    <li key={s.id}>
                      {s.employeeFirstName} {s.employeeLastName}: gross ${s.grossPay}, net ${s.netPay}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
        {runs.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No pay runs yet.</li>}
      </ul>
    </div>
  );
}
