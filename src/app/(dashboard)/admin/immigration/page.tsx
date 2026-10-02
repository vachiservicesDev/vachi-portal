'use client';

import Link from 'next/link';
import { useResource } from '@/lib/client/api';
import { fullName, visaLabel } from '@/lib/status';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, When, type Tone } from '@/components/ui/ui';

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  visaType: string;
  visaExpiryDate: string | null;
  daysUntilExpiry: number | null;
  urgency: 'expired' | 'critical' | 'warning' | 'ok';
}

const URGENCY: Record<Row['urgency'], { tone: Tone; label: (d: number) => string }> = {
  expired: { tone: 'danger', label: (d) => `Expired ${Math.abs(d)} ${Math.abs(d) === 1 ? 'day' : 'days'} ago` },
  critical: { tone: 'danger', label: (d) => (d === 0 ? 'Expires today' : `${d} ${d === 1 ? 'day' : 'days'} left`) },
  warning: { tone: 'warning', label: (d) => `${d} days left` },
  ok: { tone: 'muted', label: (d) => `${d} days left` },
};

export default function AdminImmigrationPage() {
  const { data, error, loading } = useResource<{ employees: Row[] }>('/api/immigration/dashboard');
  const rows = data?.employees ?? [];
  const counts = {
    expired: rows.filter((r) => r.urgency === 'expired').length,
    critical: rows.filter((r) => r.urgency === 'critical').length,
    warning: rows.filter((r) => r.urgency === 'warning').length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Visa expirations"
        lead="Active employees with a visa end date, soonest first. Within 30 days is urgent; within 90 days needs planning."
      />
      {error && <Alert title="Couldn't load visa dates">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="No visa dates on file">Add a visa type and expiry date on an employee’s record to track it here.</EmptyState>
      ) : (
        <div className="grid gap-6">
          <dl className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'Expired', value: counts.expired, cls: 'text-danger-700' },
              { label: 'Within 30 days', value: counts.critical, cls: 'text-danger-700' },
              { label: 'Within 90 days', value: counts.warning, cls: 'text-amber-800' },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-line bg-white p-4 sm:p-5">
                <dt className="t-label text-muted">{c.label}</dt>
                <dd className={`font-display mt-2 text-3xl font-semibold ${c.value ? c.cls : 'text-ink'}`}>{c.value}</dd>
              </div>
            ))}
          </dl>
          <DataTable
            caption="Visa expirations"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                header: 'Employee',
                primary: true,
                cell: (r) => (
                  <Link href={`/admin/employees/${r.id}`} className="font-semibold text-navy-700 hover:underline">
                    {fullName(r.firstName, r.lastName)}
                  </Link>
                ),
              },
              { header: 'Visa', cell: (r) => visaLabel(r.visaType) },
              { header: 'Expires', cell: (r) => <When iso={r.visaExpiryDate} /> },
              {
                header: 'Time left',
                cell: (r) => (r.daysUntilExpiry === null ? '—' : <Chip tone={URGENCY[r.urgency].tone}>{URGENCY[r.urgency].label(r.daysUntilExpiry)}</Chip>),
              },
            ]}
          />
        </div>
      )}
    </>
  );
}
