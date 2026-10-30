'use client';

import { useState } from 'react';
import { useResource } from '@/lib/client/api';
import { FieldRow, SelectField } from '@/components/ui/fields';
import { Alert, Chip, DataTable, DetailList, EmptyState, Loading, PageHeader, Panel, formatMoney } from '@/components/ui/ui';
import type { Register, W2 } from '@/lib/payroll/totals';

interface W2Row {
  employeeId: string;
  name: string;
  w2: W2;
  missing: string[];
  electronic: boolean;
}
interface W2Summary {
  year: number;
  final: boolean;
  rows: W2Row[];
  w3: {
    forms: number;
    box1: number;
    box2: number;
    box3: number;
    box4: number;
    box5: number;
    box6: number;
    box12D: number;
    box16: number;
    box17: number;
  };
}

const now = new Date();
const thisYear = now.getFullYear();
const YEARS = Array.from({ length: thisYear - 2019 }, (_, i) => String(thisYear - i)).map((y) => ({ value: y, label: y }));
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));
const QUARTERS = [1, 2, 3, 4].map((q) => ({
  value: String(q),
  label: `Q${q} (${['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'][q - 1]})`,
}));

function DownloadLinks({ base }: { base: string }) {
  return (
    <span className="inline-flex flex-wrap gap-3 text-sm">
      <a className="font-medium text-navy-700 underline" href={`${base}&format=pdf`}>
        Download PDF
      </a>
      <a className="font-medium text-navy-700 underline" href={`${base}&format=csv`}>
        Download CSV (Excel)
      </a>
    </span>
  );
}

function Reports() {
  const [kind, setKind] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
  const index = kind === 'month' ? month : kind === 'quarter' ? quarter : '1';
  const base = `/api/payroll/reports?kind=${kind}&year=${year}&index=${index}`;
  const { data, error, loading } = useResource<{ register: Register }>(base);
  const r = data?.register;

  return (
    <Panel
      title="Payroll register"
      description="Wages, withholding and deductions for every processed pay run in the period, by pay date. Send the PDF or CSV to your auditor or accountant, and use the Form 941 and deposit figures to pay your payroll taxes."
      actions={<DownloadLinks base={base} />}
    >
      <div className="grid gap-6">
        <FieldRow cols={3}>
          <SelectField
            name="kind"
            label="Report"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            options={[
              { value: 'month', label: 'Monthly' },
              { value: 'quarter', label: 'Quarterly (Form 941)' },
              { value: 'year', label: 'Yearly (Form 940, W-3)' },
            ]}
          />
          <SelectField name="year" label="Year" value={year} onChange={(e) => setYear(e.target.value)} options={YEARS} />
          {kind === 'month' && <SelectField name="month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} options={MONTHS} />}
          {kind === 'quarter' && <SelectField name="quarter" label="Quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)} options={QUARTERS} />}
        </FieldRow>
        {error && <Alert title="Couldn't load the report">{error}</Alert>}
        {loading && !r ? (
          <Loading />
        ) : !r ? null : r.employees.length === 0 ? (
          <EmptyState title={`Nothing paid in ${r.period.label}`}>Only pay runs marked processed count. Draft runs are left out.</EmptyState>
        ) : (
          <>
            <DetailList
              columns={3}
              items={[
                { label: 'Gross pay', value: formatMoney(r.totals.gross) },
                { label: 'Net pay', value: formatMoney(r.totals.net) },
                {
                  label: 'Pay stubs',
                  value: `${r.totals.stubs} for ${r.employees.length} ${r.employees.length === 1 ? 'person' : 'people'}`,
                },
                {
                  label: 'Federal deposits due (941 line 6)',
                  value: formatMoney(r.employer.form941.line6),
                },
                {
                  label: 'State tax withheld',
                  value: formatMoney(r.totals.state),
                },
                {
                  label: 'FUTA (Form 940)',
                  value: formatMoney(r.employer.futa),
                },
              ]}
            />
            <DataTable
              caption={`Payroll register, ${r.period.label}`}
              rows={r.employees}
              rowKey={(e) => e.employeeId}
              columns={[
                { header: 'Employee', primary: true, cell: (e) => e.name },
                {
                  header: 'Gross',
                  align: 'right',
                  cell: (e) => formatMoney(e.gross),
                },
                {
                  header: 'Federal tax',
                  align: 'right',
                  cell: (e) => formatMoney(e.federal),
                },
                {
                  header: 'Social Security',
                  align: 'right',
                  cell: (e) => formatMoney(e.socialSecurity),
                },
                {
                  header: 'Medicare',
                  align: 'right',
                  cell: (e) => formatMoney(e.medicare),
                },
                {
                  header: 'State tax',
                  align: 'right',
                  cell: (e) => formatMoney(e.state),
                },
                {
                  header: 'Deductions',
                  align: 'right',
                  cell: (e) => formatMoney(e.retirement + e.health + e.otherDeductions + e.local),
                },
                {
                  header: 'Net',
                  align: 'right',
                  cell: (e) => formatMoney(e.net),
                },
              ]}
            />
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="font-medium text-ink">Form 941 figures</h3>
                <DetailList
                  columns={1}
                  items={[
                    {
                      label: 'Line 2: wages, tips and other compensation',
                      value: formatMoney(r.employer.form941.line2),
                    },
                    {
                      label: 'Line 3: federal income tax withheld',
                      value: formatMoney(r.employer.form941.line3),
                    },
                    {
                      label: `Line 5a: Social Security, ${formatMoney(r.employer.form941.line5a)} x 12.4%`,
                      value: formatMoney(r.employer.form941.line5aTax),
                    },
                    {
                      label: `Line 5c: Medicare, ${formatMoney(r.employer.form941.line5c)} x 2.9%`,
                      value: formatMoney(r.employer.form941.line5cTax),
                    },
                    ...(r.employer.form941.line5d
                      ? [
                          {
                            label: `Line 5d: Additional Medicare, ${formatMoney(r.employer.form941.line5d)} x 0.9%`,
                            value: formatMoney(r.employer.form941.line5dTax),
                          },
                        ]
                      : []),
                    {
                      label: 'Line 6: total taxes',
                      value: formatMoney(r.employer.form941.line6),
                    },
                  ]}
                />
              </div>
              <div>
                <h3 className="font-medium text-ink">Federal deposits by month</h3>
                <DetailList
                  columns={1}
                  items={r.months.map((m) => ({
                    label: new Date(`${m.month}-01T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                    value: formatMoney(m.liability),
                  }))}
                />
                <p className="mt-2 text-sm text-muted">Withheld income tax plus both halves of Social Security and Medicare. Pay through EFTPS.</p>
              </div>
              <div>
                <h3 className="font-medium text-ink">State withholding</h3>
                <DetailList
                  columns={1}
                  items={
                    r.states.length
                      ? r.states.map((s) => ({
                          label: `${s.code} (wages ${formatMoney(s.wages)})`,
                          value: formatMoney(s.tax),
                        }))
                      : [{ label: 'None', value: formatMoney(0) }]
                  }
                />
                <p className="mt-2 text-sm text-muted">Pay and file on each state&apos;s tax website. State unemployment depends on your assigned rate and isn&apos;t included.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function W2s() {
  const [year, setYear] = useState(String(now.getMonth() < 3 ? thisYear - 1 : thisYear));
  const { data, error, loading } = useResource<W2Summary>(`/api/payroll/w2?year=${year}`);
  return (
    <Panel
      id="w2"
      title="Year-end W-2s"
      description="Each employee's W-2 from their processed pay stubs, and the W-3 totals. Employees who agreed to electronic delivery download theirs from their Pay stubs page; print and mail the rest by January 31. File Copy A and the W-3 with the Social Security Administration (Business Services Online) and your state."
    >
      <div className="grid gap-6">
        <div className="sm:max-w-xs">
          <SelectField name="w2year" label="Tax year" value={year} onChange={(e) => setYear(e.target.value)} options={YEARS} />
        </div>
        {error && <Alert title="Couldn't load W-2s">{error}</Alert>}
        {loading && !data ? (
          <Loading />
        ) : !data ? null : data.rows.length === 0 ? (
          <EmptyState title={`No W-2s for ${data.year}`}>No processed pay stubs were paid in {data.year}.</EmptyState>
        ) : (
          <>
            {!data.final && (
              <Alert tone="info" title={`${data.year} isn't over yet`}>
                These figures are year to date and will change with each pay run.
              </Alert>
            )}
            <DataTable
              caption={`W-2s for ${data.year}`}
              rows={data.rows}
              rowKey={(r) => r.employeeId}
              columns={[
                { header: 'Employee', primary: true, cell: (r) => r.name },
                {
                  header: 'Box 1 wages',
                  align: 'right',
                  cell: (r) => formatMoney(r.w2.box1),
                },
                {
                  header: 'Box 2 federal',
                  align: 'right',
                  cell: (r) => formatMoney(r.w2.box2),
                },
                {
                  header: 'Box 4 SS',
                  align: 'right',
                  cell: (r) => formatMoney(r.w2.box4),
                },
                {
                  header: 'Box 6 Medicare',
                  align: 'right',
                  cell: (r) => formatMoney(r.w2.box6),
                },
                {
                  header: 'Box 17 state',
                  align: 'right',
                  cell: (r) => formatMoney(r.w2.states.reduce((s, x) => s + x.tax, 0)),
                },
                {
                  header: 'Status',
                  cell: (r) =>
                    r.missing.length ? <Chip tone="warning">Needs {r.missing.join(' and ')}</Chip> : r.electronic ? <Chip tone="live">Electronic</Chip> : <Chip tone="info">Mail paper copy</Chip>,
                },
                {
                  header: 'W-2',
                  align: 'right',
                  cell: (r) => (
                    <a className="text-sm font-medium text-navy-700 underline" href={`/api/payroll/w2/${r.employeeId}/${data.year}/pdf`}>
                      PDF
                    </a>
                  ),
                },
              ]}
            />
            <div>
              <h3 className="font-medium text-ink">W-3 totals</h3>
              <DetailList
                columns={3}
                items={[
                  {
                    label: 'c  Total number of W-2s',
                    value: String(data.w3.forms),
                  },
                  {
                    label: '1  Wages, tips, other compensation',
                    value: formatMoney(data.w3.box1),
                  },
                  {
                    label: '2  Federal income tax withheld',
                    value: formatMoney(data.w3.box2),
                  },
                  {
                    label: '3  Social security wages',
                    value: formatMoney(data.w3.box3),
                  },
                  {
                    label: '4  Social security tax withheld',
                    value: formatMoney(data.w3.box4),
                  },
                  {
                    label: '5  Medicare wages and tips',
                    value: formatMoney(data.w3.box5),
                  },
                  {
                    label: '6  Medicare tax withheld',
                    value: formatMoney(data.w3.box6),
                  },
                  {
                    label: '12a  Deferred compensation (code D)',
                    value: formatMoney(data.w3.box12D),
                  },
                  {
                    label: '16 / 17  State wages / state tax',
                    value: `${formatMoney(data.w3.box16)} / ${formatMoney(data.w3.box17)}`,
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function PayrollReportsPage() {
  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Payroll reports and W-2s" lead="Monthly, quarterly and yearly payroll registers for your auditor and tax payments, and each employee's year-end W-2." />
      <div className="grid gap-6">
        <Reports />
        <W2s />
      </div>
    </>
  );
}
