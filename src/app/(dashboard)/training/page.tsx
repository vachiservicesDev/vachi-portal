'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Assignment {
  id: string;
  status: string;
  taskTitle: string;
  taskType: string;
  taskPriority: string;
  taskDueDate: string | null;
  taskIsMandatory: boolean;
}

export default function EmployeeTrainingPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/training/assignments/me')
      .then((res) => res.json())
      .then((data) => {
        setAssignments(data.assignments);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Training</h1>
        <Link href="/training/summaries" className="text-sm text-indigo-600 hover:underline">
          Weekly summaries →
        </Link>
      </div>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{a.taskTitle}</p>
              <p className="text-sm text-gray-500">
                {a.taskType} · {a.taskPriority}
                {a.taskIsMandatory && ' · mandatory'}
                {a.taskDueDate && ` · due ${a.taskDueDate}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{a.status}</span>
              <Link href={`/training/${a.id}`} className="text-sm text-indigo-600 hover:underline">
                Open →
              </Link>
            </div>
          </li>
        ))}
        {assignments.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">No training assigned yet.</li>
        )}
      </ul>
    </div>
  );
}
