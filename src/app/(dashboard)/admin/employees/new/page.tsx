'use client';

import { useRouter } from 'next/navigation';
import { formValues, useAction } from '@/lib/client/api';
import { Button, LinkButton } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { PageHeader, Panel } from '@/components/ui/ui';
import { EMPLOYEE_LABELS, EmployeeFields } from '../EmployeeForm';

export default function NewEmployeePage() {
  const router = useRouter();
  const action = useAction();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action.run<{ employee: { id: string } }>('save', '/api/employees', { body: formValues(e.currentTarget) });
    if (result.ok && result.data) router.push(`/admin/employees/${result.data.employee.id}?created=1`);
  }

  return (
    <>
      <PageHeader
        back={{ href: '/admin/employees', label: 'Employees' }}
        title="Add employee"
        lead="Creates their record. You can invite them to the portal on the next screen."
      />
      <Panel>
        <form onSubmit={handleSubmit} className="grid gap-8">
          <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={EMPLOYEE_LABELS} />
          <EmployeeFields errors={action.fieldErrors} />
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <LinkButton href="/admin/employees" variant="secondary">
              Cancel
            </LinkButton>
            <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving">
              Save employee
            </Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
