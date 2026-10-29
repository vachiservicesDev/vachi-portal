'use client';

import { useResource } from '@/lib/client/api';
import { Alert, Loading, formatMoney } from '@/components/ui/ui';
import type { Statement, StatementLine } from '@/lib/payroll/stub';

function Lines({ title, rows, withHours, total, totalLabel, negative }: { title: string; rows: StatementLine[]; withHours?: boolean; total: [number, number]; totalLabel: string; negative?: boolean }) {
  const neg = (n: number) => (negative && n ? `−${formatMoney(n)}` : formatMoney(n));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th scope="col" className="py-2 font-semibold text-ink">{title}</th>
            {withHours && <th scope="col" className="py-2 text-right font-medium">Rate</th>}
            {withHours && <th scope="col" className="py-2 text-right font-medium">Hours</th>}
            <th scope="col" className="py-2 text-right font-medium">This period</th>
            <th scope="col" className="py-2 text-right font-medium">Year to date</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="py-2 text-muted" colSpan={withHours ? 5 : 3}>None</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line/60">
              <th scope="row" className="py-2 text-left font-normal text-ink">
                {r.label}
                {r.preTax && <span className="text-muted"> (pre-tax)</span>}
              </th>
              {withHours && <td className="py-2 text-right tabular-nums">{r.rate !== undefined ? formatMoney(r.rate) : ''}</td>}
              {withHours && <td className="py-2 text-right tabular-nums">{r.hours !== undefined ? r.hours.toFixed(2) : ''}</td>}
              <td className="py-2 text-right tabular-nums">{r.current ? neg(r.current) : '—'}</td>
              <td className="py-2 text-right tabular-nums text-ink-2">{formatMoney(r.ytd)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <th scope="row" className="py-2 text-left">{totalLabel}</th>
            {withHours && <td />}
            {withHours && <td />}
            <td className="py-2 text-right tabular-nums">{neg(total[0])}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(total[1])}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** One pay stub, itemized with year-to-date, plus the PDF download. */
export function StatementView({ stubId }: { stubId: string }) {
  const { data, error, loading } = useResource<{ statement: Statement; stub: { payDate: string } }>(`/api/payroll/stubs/${stubId}`);
  if (loading && !data) return <Loading label="Loading pay stub" />;
  if (!data) return <Alert title="Couldn't load this pay stub">{error}</Alert>;
  const s = data.statement;
  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-4 sm:p-5">
      <Lines title="Earnings" rows={s.earnings} withHours total={s.totals.gross} totalLabel="Gross pay" />
      <Lines title="Taxes withheld" rows={s.taxes} total={s.totals.taxes} totalLabel="Total taxes" negative />
      <Lines title="Deductions" rows={s.deductions} total={s.totals.deductions} totalLabel="Total deductions" negative />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-navy-50 px-4 py-3">
        <p className="font-semibold text-ink">
          Net pay {formatMoney(s.totals.net[0])}
          <span className="ml-2 text-sm font-normal text-muted">
            {s.paymentMethod === 'check' ? 'by check' : 'by direct deposit'} · {formatMoney(s.totals.net[1])} this year
          </span>
        </p>
        <a href={`/api/payroll/stubs/${stubId}/pdf`} className="font-medium text-navy-700 underline">
          Download PDF
        </a>
      </div>
    </div>
  );
}
