'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { DueChip } from '@/components/ui/DueChip';
import { FieldRow, SelectField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel } from '@/components/ui/ui';

interface Plan {
  id: string;
  employeeId: string;
  status: string;
  employerName: string;
  selfEvaluationDueAt: string | null;
  selfEvaluationCompletedAt: string | null;
  finalEvaluationDueAt: string | null;
  finalEvaluationCompletedAt: string | null;
  employeeFirstName: string;
  employeeLastName: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  visaType: string | null;
}

const LABELS = { employeeId: 'Employee', employerName: 'Employer name', trainingStartDate: 'Training starts', trainingEndDate: 'Training ends', i983SubmittedAt: 'I-983 submitted' };

export default function AdminStemOptPage() {
  const plans = useResource<{ plans: Plan[] }>('/api/stem-opt');
  const people = useResource<{ employees: EmployeeOption[] }>('/api/employees');
  const action = useAction();
  const list = plans.data?.plans ?? [];
  const withPlan = new Set(list.map((p) => p.employeeId));
  const available = (people.data?.employees ?? [])
    .filter((e) => e.status !== 'inactive' && !withPlan.has(e.id))
    // STEM OPT employees first, since they're the ones who need a plan.
    .sort((a, b) => Number(b.visaType === 'STEM_OPT') - Number(a.visaType === 'STEM_OPT'));

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('create', '/api/stem-opt', { body: formValues(form) }, 'Plan created. The 12-month and final evaluation dates were set from the training dates.');
    if (result.ok) {
      form.reset();
      plans.reload();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Immigration"
        title="STEM OPT training plans"
        lead="Form I-983 plans and their two required evaluations: one at 12 months and a final one when training ends."
      />
      <div className="grid gap-8">
        <Panel title="Create a plan">
          <form onSubmit={create} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={LABELS} />
            {people.loading && !people.data ? (
              <Loading label="Loading employees" />
            ) : available.length === 0 ? (
              <p className="text-ink-2">Every active employee already has a plan.</p>
            ) : (
              <>
                <FieldRow>
                  <SelectField
                    name="employeeId"
                    label="Employee"
                    required
                    placeholder="Choose an employee"
                    options={available.map((e) => ({ value: e.id, label: `${fullName(e.firstName, e.lastName)}${e.visaType === 'STEM_OPT' ? ' (STEM OPT)' : ''}` }))}
                    errors={action.fieldErrors}
                  />
                  <TextField name="employerName" label="Employer name" required defaultValue="Vachi Services LLC" maxLength={255} errors={action.fieldErrors} />
                </FieldRow>
                <FieldRow cols={3}>
                  <TextField name="trainingStartDate" label="Training starts" type="date" required errors={action.fieldErrors} />
                  <TextField name="trainingEndDate" label="Training ends" type="date" required errors={action.fieldErrors} hint="Up to 24 months after the start." />
                  <TextField name="i983SubmittedAt" label="I-983 submitted" type="date" errors={action.fieldErrors} />
                </FieldRow>
                <div>
                  <Button type="submit" busy={action.busy === 'create'} busyLabel="Creating…">
                    Create plan
                  </Button>
                </div>
              </>
            )}
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Plans</h2>
          {plans.error && <Alert title="Couldn't load plans">{plans.error}</Alert>}
          {plans.loading && !plans.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState>No STEM OPT plans yet.</EmptyState>
          ) : (
            <DataTable
              caption="STEM OPT training plans"
              rows={list}
              rowKey={(p) => p.id}
              columns={[
                {
                  header: 'Employee',
                  primary: true,
                  cell: (p) => (
                    <Link href={`/admin/stem-opt/${p.id}`} className="font-semibold text-navy-700 hover:underline">
                      {fullName(p.employeeFirstName, p.employeeLastName)}
                    </Link>
                  ),
                },
                {
                  header: 'Status',
                  cell: (p) => {
                    const s = statusOf('stemOpt', p.status);
                    return <Chip tone={s.tone}>{s.label}</Chip>;
                  },
                },
                { header: '12-month evaluation', cell: (p) => <DueChip due={p.selfEvaluationDueAt} done={p.selfEvaluationCompletedAt} /> },
                { header: 'Final evaluation', cell: (p) => <DueChip due={p.finalEvaluationDueAt} done={p.finalEvaluationCompletedAt} /> },
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
