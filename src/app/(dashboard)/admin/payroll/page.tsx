'use client';

import { useState } from 'react';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, DateRange, EmptyState, Loading, PageHeader, Panel, When, formatMoney } from '@/components/ui/ui';

interface PayRun {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  status: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface Stub {
  id: string;
  employeeId: string;
  grossPay: string;
  netPay: string;
  employeeFirstName: string;
  employeeLastName: string;
}

const RUN_LABELS = { payPeriodStart: 'Period starts', payPeriodEnd: 'Period ends', payDate: 'Pay date' };
const STUB_LABELS = { employeeId: 'Employee', grossPay: 'Gross pay', netPay: 'Net pay' };

function RunDetail({ run, employees }: { run: PayRun; employees: EmployeeOption[] }) {
  const detail = useResource<{ run: PayRun; stubs: Stub[] }>(`/api/payroll/runs/${run.id}`);
  const action = useAction();
  const stubs = detail.data?.stubs ?? [];
  const paid = new Set(stubs.map((s) => s.employeeId));
  const available = employees.filter((e) => e.status !== 'inactive' && !paid.has(e.id));
  const totals = stubs.reduce((acc, s) => ({ gross: acc.gross + Number(s.grossPay), net: acc.net + Number(s.netPay) }), { gross: 0, net: 0 });

  async function addStub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('stub', `/api/payroll/runs/${run.id}/stubs`, { body: formValues(form) }, 'Pay stub added. The employee can see it now.');
    if (result.ok) {
      form.reset();
      detail.reload();
    }
  }

  return (
    <Panel
      id="run-detail"
      title={
        <>
          Pay run for <DateRange from={run.payPeriodStart} to={run.payPeriodEnd} />
        </>
      }
      description={
        <>
          Paid on <When iso={run.payDate} />. {stubs.length} {stubs.length === 1 ? 'stub' : 'stubs'}, {formatMoney(totals.gross)} gross, {formatMoney(totals.net)} net.
        </>
      }
    >
      {detail.error && <Alert title="Couldn't load this pay run">{detail.error}</Alert>}
      {detail.loading && !detail.data ? (
        <Loading label="Loading pay stubs" />
      ) : stubs.length === 0 ? (
        <EmptyState>No pay stubs in this run yet. Add one below.</EmptyState>
      ) : (
        <DataTable
          caption="Pay stubs in this run"
          rows={stubs}
          rowKey={(s) => s.id}
          columns={[
            { header: 'Employee', primary: true, cell: (s) => fullName(s.employeeFirstName, s.employeeLastName) },
            { header: 'Gross pay', align: 'right', cell: (s) => formatMoney(s.grossPay) },
            { header: 'Net pay', align: 'right', cell: (s) => formatMoney(s.netPay) },
          ]}
        />
      )}

      <form onSubmit={addStub} noValidate className="mt-8 grid gap-5 border-t border-line pt-6">
        <h3 className="font-display text-lg font-semibold text-ink">Add a pay stub</h3>
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={STUB_LABELS} />
        {available.length === 0 ? (
          <p className="text-ink-2">Every active employee already has a stub in this run.</p>
        ) : (
          <>
            <SelectField
              name="employeeId"
              label="Employee"
              required
              placeholder="Choose an employee"
              options={available.map((e) => ({ value: e.id, label: fullName(e.firstName, e.lastName) }))}
              errors={action.fieldErrors}
            />
            <FieldRow>
              <TextField name="grossPay" label="Gross pay (USD)" type="number" inputMode="decimal" min={0} step="0.01" required errors={action.fieldErrors} />
              <TextField name="netPay" label="Net pay (USD)" type="number" inputMode="decimal" min={0} step="0.01" required errors={action.fieldErrors} hint="Can't be more than gross pay." />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'stub'} busyLabel="Adding…">
                Add pay stub
              </Button>
            </div>
          </>
        )}
      </form>
    </Panel>
  );
}

export default function AdminPayrollPage() {
  const runs = useResource<{ runs: PayRun[] }>('/api/payroll/runs');
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const [selected, setSelected] = useState<string | null>(null);
  const list = runs.data?.runs ?? [];
  const current = list.find((r) => r.id === selected) ?? null;

  async function createRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run<{ run: PayRun }>('run', '/api/payroll/runs', { body: formValues(form) }, 'Pay run recorded. Add its pay stubs below.');
    if (result.ok && result.data) {
      form.reset();
      await runs.reload();
      setSelected(result.data.run.id);
    }
  }

  function open(id: string) {
    setSelected(id);
    requestAnimationFrame(() => document.getElementById('run-detail')?.scrollIntoView({ block: 'start' }));
  }

  return (
    <>
      <PageHeader eyebrow="Work and pay" title="Payroll" lead="Record each pay run, then add a stub for every employee paid in it. Employees see their stubs under Pay stubs." />
      <div className="grid gap-8">
        <Panel title="Record a pay run">
          <form onSubmit={createRun} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={RUN_LABELS} />
            <FieldRow cols={3}>
              <TextField name="payPeriodStart" label="Period starts" type="date" required errors={action.fieldErrors} />
              <TextField name="payPeriodEnd" label="Period ends" type="date" required errors={action.fieldErrors} />
              <TextField name="payDate" label="Pay date" type="date" required errors={action.fieldErrors} />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'run'} busyLabel="Recording…">
                Record pay run
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Pay runs</h2>
          {runs.error && <Alert title="Couldn't load pay runs">{runs.error}</Alert>}
          {runs.loading && !runs.data ? (
            <Loading label="Loading pay runs" />
          ) : list.length === 0 ? (
            <EmptyState>No pay runs yet. Record the first one above.</EmptyState>
          ) : (
            <DataTable
              caption="Pay runs"
              rows={list}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Pay period', primary: true, cell: (r) => <DateRange from={r.payPeriodStart} to={r.payPeriodEnd} /> },
                { header: 'Pay date', cell: (r) => <When iso={r.payDate} /> },
                {
                  header: 'Status',
                  cell: (r) => {
                    const s = statusOf('payRun', r.status);
                    return <Chip tone={s.tone}>{s.label}</Chip>;
                  },
                },
                {
                  header: 'Stubs',
                  align: 'right',
                  cell: (r) => (
                    <Button variant={r.id === selected ? 'primary' : 'secondary'} size="sm" onClick={() => open(r.id)} aria-pressed={r.id === selected}>
                      {r.id === selected ? 'Viewing' : 'View stubs'}
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </section>

        {current && <RunDetail key={current.id} run={current} employees={people.data?.employees ?? []} />}
      </div>
    </>
  );
}
