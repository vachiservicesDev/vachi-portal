'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Timesheet {
  id: string;
  weekStarting: string;
  weekEnding: string;
  totalHours: string;
  status: string;
  employeeFirstName: string;
  employeeLastName: string;
}

export default function AdminTimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  useEffect(() => {
    fetch('/api/timesheets')
      .then((res) => res.json())
      .then((data) => setTimesheets(data.timesheets));
  }, []);

  const pending = timesheets.filter((t) => t.status === 'submitted');
  const others = timesheets.filter((t) => t.status !== 'submitted');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Timesheets</h1>

      <h2 className="mt-6 font-medium">Pending approval</h2>
      <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {pending.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3">
            <span>
              {t.employeeFirstName} {t.employeeLastName} · {t.weekStarting} – {t.weekEnding}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{t.totalHours}h</span>
              <Link href={`/admin/timesheets/${t.id}`} className="text-sm text-indigo-600 hover:underline">
                Review →
              </Link>
            </div>
          </li>
        ))}
        {pending.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nothing pending.</li>}
      </ul>

      <h2 className="mt-6 font-medium">All others</h2>
      <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {others.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {t.employeeFirstName} {t.employeeLastName} · {t.weekStarting} – {t.weekEnding}
            </span>
            <span className="text-gray-500">
              {t.totalHours}h · {t.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
