'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { inputClass, borderClass, SelectField } from '@/components/ui/fields';
import { Alert, Chip, Loading, PageHeader, Panel } from '@/components/ui/ui';
import { EMPLOYEE_LABELS, EmployeeFields, OPTIONAL_EMPLOYEE_FIELDS, type EmployeeValues } from '../EmployeeForm';

interface Detail {
  employee: EmployeeValues & { id: string; firstName: string; lastName: string; email: string; status: string; userId: string | null };
  access: { status: 'none' | 'active' | 'disabled'; role: 'admin' | 'employee' | null; email: string | null };
  isSelf: boolean;
}

function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-line bg-subtle p-4">
      <label htmlFor="invite-link" className="text-sm font-medium text-ink">
        One-time sign-in link
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} ${borderClass(false)} font-mono text-sm`} />
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">Send it to the employee privately. It works once, expires after 24 hours and lets them choose their password.</p>
    </div>
  );
}

function AccessPanel({ detail, reload }: { detail: Detail; reload: () => Promise<void> }) {
  const action = useAction();
  const [link, setLink] = useState<string | null>(null);
  const { access, employee, isSelf } = detail;
  const inactive = employee.status === 'inactive';

  async function invite(mode: 'email' | 'link') {
    setLink(null);
    const result = await action.run<{ outcome: string; link: string | null }>(mode, `/api/employees/${employee.id}/invite`, { body: { mode } });
    if (!result.ok || !result.data) return;
    if (result.data.link) setLink(result.data.link);
    action.setSuccess(
      result.data.outcome === 'emailed'
        ? access.status === 'none'
          ? `Invite sent to ${employee.email}. The link expires in 24 hours.`
          : `Password reset email sent to ${employee.email}.`
        : result.data.outcome === 'existing-account'
          ? `${employee.email} already had a login, so it's now linked to the portal. They sign in with their existing password.`
          : 'Link created. Copy it below.',
    );
    await reload();
  }

  async function changeRole(role: string) {
    const result = await action.run('role', `/api/employees/${employee.id}`, { method: 'PATCH', body: { role } }, role === 'admin' ? 'Now a portal admin.' : 'Now a regular employee.');
    if (result.ok) await reload();
  }

  return (
    <Panel
      title="Portal access"
      description={
        access.status === 'none'
          ? 'They don’t have a login yet. Invite them so they can complete their Form I-9, log time and see pay stubs.'
          : access.status === 'disabled'
            ? 'Their login is turned off because the employee is inactive.'
            : `Signs in as ${access.email}.`
      }
      actions={
        access.status === 'none' ? (
          <Chip tone="draft">No login yet</Chip>
        ) : access.status === 'disabled' ? (
          <Chip tone="muted">Login disabled</Chip>
        ) : access.role === 'admin' ? (
          <Chip tone="info">Admin</Chip>
        ) : (
          <Chip tone="live">Has login</Chip>
        )
      }
    >
      <div className="grid gap-4">
        <FormStatus error={action.error} success={action.success} />
        {inactive ? (
          <p className="text-ink-2">Set their status to active to invite them or send a sign-in link.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button onClick={() => invite('email')} busy={action.busy === 'email'} busyLabel="Sending" disabled={!!action.busy}>
              {access.status === 'none' ? 'Email an invite' : 'Email a password reset'}
            </Button>
            <Button variant="secondary" onClick={() => invite('link')} busy={action.busy === 'link'} busyLabel="Creating link" disabled={!!action.busy}>
              {access.status === 'none' ? 'Create invite link instead' : 'Create sign-in link'}
            </Button>
          </div>
        )}
        {link && <InviteLink link={link} />}
        {access.status === 'active' && (
          <div className="border-t border-line pt-5">
            <SelectField
              name="role"
              label="Portal role"
              hideOptional
              className="sm:max-w-xs"
              value={access.role ?? 'employee'}
              onChange={(e) => changeRole(e.target.value)}
              disabled={isSelf || !!action.busy}
              hint={isSelf ? "You can't change your own role." : 'Admins see every employee’s records and can approve, edit and invite.'}
              options={[
                { value: 'employee', label: 'Employee' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}

function EditPanel({ detail, reload }: { detail: Detail; reload: () => Promise<void> }) {
  const action = useAction();
  const [formKey, setFormKey] = useState(0);
  const { employee } = detail;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const body: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      const value = v.trim();
      // Clearing an optional field saves it as empty.
      if (value === '') {
        if ((OPTIONAL_EMPLOYEE_FIELDS as readonly string[]).includes(k)) body[k] = null;
      } else body[k] = value;
    }
    if (employee.userId) delete body.email;
    const result = await action.run('save', `/api/employees/${employee.id}`, { method: 'PATCH', body }, 'Saved.');
    if (result.ok) {
      await reload();
      setFormKey((k) => k + 1);
    }
  }

  return (
    <Panel title="Details">
      <form key={formKey} onSubmit={handleSubmit} className="grid gap-8">
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={EMPLOYEE_LABELS} />
        <EmployeeFields values={employee} errors={action.fieldErrors} emailLocked={!!employee.userId} />
        <div className="flex justify-end border-t border-line pt-6">
          <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving">
            Save changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function EmployeeDetail() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { data, error, loading, reload } = useResource<Detail>(`/api/employees/${params.id}`);

  if (loading && !data) return <Loading />;
  if (!data) return <Alert title="Couldn't load this employee">{error}</Alert>;

  const s = statusOf('employee', data.employee.status);
  return (
    <>
      <PageHeader
        back={{ href: '/admin/employees', label: 'Employees' }}
        title={fullName(data.employee.firstName, data.employee.lastName)}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{data.employee.email}</span>
            <Chip tone={s.tone}>{s.label}</Chip>
          </span>
        }
      />
      {search.get('created') && (
        <div className="mb-6">
          <Alert tone="success">Employee added. Invite them to the portal when you&apos;re ready.</Alert>
        </div>
      )}
      <div className="grid gap-6">
        <AccessPanel detail={data} reload={reload} />
        <EditPanel detail={data} reload={reload} />
      </div>
    </>
  );
}

export default function EmployeeDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EmployeeDetail />
    </Suspense>
  );
}
