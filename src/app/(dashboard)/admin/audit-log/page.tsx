'use client';

import { useEffect, useState } from 'react';

interface Entry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/audit-log')
      .then((res) => res.json())
      .then((data) => {
        setEntries(data.entries);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">
        Most recent 200 entries. Only a representative set of sensitive actions write here today
        (I-9 Section 2 completion, timesheet approve/reject, green card stage changes) — see
        src/lib/audit/log.ts to extend coverage.
      </p>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {entries.map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{e.action}</span> on {e.resourceType}
            {e.actorEmail && ` by ${e.actorEmail}`}
            <span className="ml-2 text-gray-500">{new Date(e.createdAt).toLocaleString()}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No entries yet.</li>}
      </ul>
    </div>
  );
}
