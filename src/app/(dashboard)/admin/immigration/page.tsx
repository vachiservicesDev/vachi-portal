'use client';

import { useEffect, useState } from 'react';

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  visaType: string;
  visaExpiryDate: string | null;
  daysUntilExpiry: number | null;
  urgency: 'expired' | 'critical' | 'warning' | 'ok';
}

const urgencyStyles: Record<Row['urgency'], string> = {
  expired: 'bg-red-100 text-red-800',
  critical: 'bg-orange-100 text-orange-800',
  warning: 'bg-yellow-100 text-yellow-800',
  ok: 'bg-green-100 text-green-800',
};

export default function AdminImmigrationPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/immigration/dashboard')
      .then((res) => res.json())
      .then((data) => {
        setRows(data.employees);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Immigration Tracker</h1>
      <p className="mt-1 text-sm text-gray-500">
        Visa expiry status, sorted by urgency. Document-level expiry tracking joins in once the
        documents feature has real data.
      </p>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {r.firstName} {r.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {r.visaType} · expires {r.visaExpiryDate}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${urgencyStyles[r.urgency]}`}>
              {r.daysUntilExpiry !== null && r.daysUntilExpiry < 0
                ? `expired ${Math.abs(r.daysUntilExpiry)}d ago`
                : `${r.daysUntilExpiry}d left`}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">No employees with a visa expiry date set.</li>
        )}
      </ul>
    </div>
  );
}
