'use client';

import { useResource } from '@/lib/client/api';
import { Alert, DataTable, DateRange, EmptyState, Loading, PageHeader, When, formatMoney } from '@/components/ui/ui';

interface Stub {
  id: string;
  grossPay: string;
  netPay: string;
  payDate: string;
  payPeriodStart: string;
  payPeriodEnd: string;
}

export default function PayrollPage() {
  const { data, error, loading } = useResource<{ stubs: Stub[] }>('/api/payroll/stubs/me');
  const stubs = data?.stubs ?? [];
  const ytdYear = String(new Date().getFullYear());
  const ytd = stubs.filter((s) => s.payDate?.startsWith(ytdYear)).reduce((acc, s) => ({ gross: acc.gross + Number(s.grossPay), net: acc.net + Number(s.netPay) }), { gross: 0, net: 0 });

  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Pay stubs" lead="Your pay stubs, newest first. If something looks wrong, message HR." />
      {error && <Alert title="Couldn't load your pay stubs">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : stubs.length === 0 ? (
        <EmptyState title="No pay stubs yet">Your stubs appear here once HR records your first pay run.</EmptyState>
      ) : (
        <div className="grid gap-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-5">
              <dt className="t-label text-muted">Gross pay in {ytdYear}</dt>
              <dd className="font-display mt-2 text-3xl font-semibold text-ink">{formatMoney(ytd.gross)}</dd>
            </div>
            <div className="rounded-lg border border-line bg-white p-5">
              <dt className="t-label text-muted">Net pay in {ytdYear}</dt>
              <dd className="font-display mt-2 text-3xl font-semibold text-ink">{formatMoney(ytd.net)}</dd>
            </div>
          </dl>
          <DataTable
            caption="Your pay stubs"
            rows={stubs}
            rowKey={(s) => s.id}
            columns={[
              { header: 'Pay date', primary: true, cell: (s) => <When iso={s.payDate} /> },
              { header: 'Pay period', cell: (s) => <DateRange from={s.payPeriodStart} to={s.payPeriodEnd} /> },
              { header: 'Gross pay', align: 'right', cell: (s) => formatMoney(s.grossPay) },
              { header: 'Net pay', align: 'right', cell: (s) => formatMoney(s.netPay) },
            ]}
          />
        </div>
      )}
    </>
  );
}
