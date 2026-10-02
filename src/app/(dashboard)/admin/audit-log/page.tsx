'use client';

import { useMemo, useState } from 'react';
import { useResource } from '@/lib/client/api';
import { Alert, DataTable, EmptyState, Loading, PageHeader, When } from '@/components/ui/ui';
import { inputClass, borderClass } from '@/components/ui/fields';

interface Entry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string;
}

function humanize(s: string) {
  const t = s.replace(/[._]/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Change({ entry }: { entry: Entry }) {
  const keys = Array.from(new Set([...Object.keys(entry.oldValues ?? {}), ...Object.keys(entry.newValues ?? {})]));
  if (keys.length === 0) return <span className="text-muted">—</span>;
  return (
    <ul className="grid gap-0.5 text-sm">
      {keys.slice(0, 4).map((k) => {
        const from = entry.oldValues?.[k];
        const to = entry.newValues?.[k];
        return (
          <li key={k} className="break-words">
            <span className="text-muted">{humanize(k)}:</span> {from !== undefined && from !== null ? <>{String(from)} → </> : null}
            {to !== undefined && to !== null ? String(to) : '—'}
          </li>
        );
      })}
    </ul>
  );
}

export default function AuditLogPage() {
  const { data, error, loading } = useResource<{ entries: Entry[] }>('/api/admin/audit-log');
  const [q, setQ] = useState('');
  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((e) => [e.action, e.resourceType, e.actorEmail ?? ''].some((v) => v.toLowerCase().includes(term)));
  }, [data, q]);

  return (
    <>
      <PageHeader eyebrow="Communication" title="Audit log" lead="The latest 200 sensitive changes: who made them, when, and what changed." />
      {error && <Alert title="Couldn't load the audit log">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="grid gap-4">
          <div className="max-w-md">
            <label htmlFor="f-audit-search" className="text-sm font-medium text-ink">
              Filter
            </label>
            <input
              id="f-audit-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Action, record type or person"
              className={`${inputClass} ${borderClass(false)} mt-1.5`}
            />
          </div>
          {entries.length === 0 ? (
            <EmptyState>{q ? 'Nothing matches that filter.' : 'No audited changes yet.'}</EmptyState>
          ) : (
            <DataTable
              caption="Audit log"
              rows={entries}
              rowKey={(e) => e.id}
              columns={[
                { header: 'What happened', primary: true, cell: (e) => humanize(e.action) },
                { header: 'Record', cell: (e) => humanize(e.resourceType) },
                { header: 'Change', cell: (e) => <Change entry={e} /> },
                { header: 'By', cell: (e) => <span className="break-all">{e.actorEmail ?? 'System'}</span> },
                { header: 'When', cell: (e) => <When iso={e.createdAt} withTime /> },
              ]}
            />
          )}
        </div>
      )}
    </>
  );
}
