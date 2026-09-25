'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: string | null;
  isMandatory: boolean;
}

export default function AdminTrainingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/training/tasks');
    if (res.ok) setTasks((await res.json()).tasks);
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
    const res = await fetch('/api/training/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, isMandatory: data.isMandatory === 'on' }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to create task');
      return;
    }
    formEl.reset();
    setShowForm(false);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Training</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'New task'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 space-y-3 rounded-lg border border-gray-200 p-6">
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Description (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select name="type" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="general">General</option>
              <option value="compliance">Compliance</option>
              <option value="safety">Safety</option>
              <option value="technical">Technical</option>
            </select>
            <select name="priority" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="dueDate" type="date" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="estimatedDurationMinutes" type="number" min="1" placeholder="Duration (min)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <input name="contentUrl" type="url" placeholder="Content/materials URL (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isMandatory" /> Mandatory
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </form>
      )}

      <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-gray-500">
                {t.type} · {t.priority}
                {t.isMandatory && ' · mandatory'}
                {t.dueDate && ` · due ${t.dueDate}`}
              </p>
            </div>
            <Link href={`/admin/training/${t.id}`} className="text-sm text-indigo-600 hover:underline">
              Manage →
            </Link>
          </li>
        ))}
        {tasks.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No training tasks yet.</li>}
      </ul>
    </div>
  );
}
