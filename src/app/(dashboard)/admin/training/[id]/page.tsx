'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  description: string | null;
}

interface Assignment {
  id: string;
  status: string;
  score: number | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default function AdminTrainingTaskPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [taskRes, employeesRes] = await Promise.all([
      fetch(`/api/training/tasks/${params.id}`),
      fetch('/api/employees'),
    ]);
    if (taskRes.ok) {
      const data = await taskRes.json();
      setTask(data.task);
      setAssignments(data.assignments);
    }
    if (employeesRes.ok) setEmployees((await employeesRes.json()).employees);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.id only
  }, [params.id]);

  async function handleAssign() {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/training/tasks/${params.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeIds: selected }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to assign');
      return;
    }
    setSelected([]);
    load();
  }

  if (!task) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  const assignedIds = new Set(
    assignments.map((a) => `${a.employeeFirstName}|${a.employeeLastName}`),
  );
  const unassigned = employees.filter(
    (e) => !assignedIds.has(`${e.firstName}|${e.lastName}`),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{task.title}</h1>
      {task.description && <p className="mt-2 text-sm text-gray-600">{task.description}</p>}

      <section className="mt-6 rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium">Assign to employees</h2>
        <select
          multiple
          value={selected}
          onChange={(e) => setSelected(Array.from(e.target.selectedOptions, (o) => o.value))}
          className="mt-2 h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {unassigned.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleAssign}
          disabled={selected.length === 0 || busy}
          className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Assigning…' : 'Assign selected'}
        </button>
      </section>

      <section className="mt-4">
        <h2 className="font-medium">Assignments</h2>
        <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <span>
                {a.employeeFirstName} {a.employeeLastName}
              </span>
              <span className="text-sm text-gray-500">
                {a.status}
                {a.score !== null && ` · ${a.score}%`}
              </span>
            </li>
          ))}
          {assignments.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No one assigned yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
