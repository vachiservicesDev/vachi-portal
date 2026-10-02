'use client';

import { useResource } from '@/lib/client/api';
import { LinkButton } from '@/components/ui/Button';
import { Alert, Loading, PageHeader, Panel, StatCard, TextLink } from '@/components/ui/ui';

interface Stats {
  pendingOnboarding: number;
  overdueI9Section2: number;
  pendingTimesheets: number;
  pendingTrainingSummaries: number;
  visasExpiringSoon: number;
}

export default function AdminHomePage() {
  const { data: stats, error, loading } = useResource<Stats>('/api/admin/dashboard');

  return (
    <>
      <PageHeader
        eyebrow="Portal admin"
        title="What needs attention"
        lead="Open items across onboarding, compliance and approvals. Numbers update each time you open this page."
        actions={
          <>
            <LinkButton href="/admin/employees/new" variant="secondary">
              Add employee
            </LinkButton>
            <LinkButton href="/admin/onboarding">Start onboarding</LinkButton>
          </>
        }
      />
      {error && (
        <div className="mb-6">
          <Alert title="Couldn't load the dashboard">{error}</Alert>
        </div>
      )}
      {loading && !stats ? (
        <Loading />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            href="/admin/i9"
            value={stats?.overdueI9Section2 ?? '–'}
            label="Overdue I-9 Section 2"
            hint="Section 2 is due within 3 business days of the first day of work."
            tone={stats?.overdueI9Section2 ? 'danger' : undefined}
          />
          <StatCard
            href="/admin/immigration"
            value={stats?.visasExpiringSoon ?? '–'}
            label="Visas expiring within 30 days"
            hint="Includes any that have already expired."
            tone={stats?.visasExpiringSoon ? 'warning' : undefined}
          />
          <StatCard href="/admin/onboarding" value={stats?.pendingOnboarding ?? '–'} label="Onboarding in progress" hint="Sessions not yet completed." />
          <StatCard href="/admin/timesheets" value={stats?.pendingTimesheets ?? '–'} label="Timesheets to approve" hint="Submitted by employees." />
          <StatCard
            href="/admin/training/summaries"
            value={stats?.pendingTrainingSummaries ?? '–'}
            label="Weekly summaries to review"
            hint="Submitted training summaries."
          />
        </ul>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="People" description="Add employees, give them a portal login and keep their visa details current.">
          <ul className="grid gap-3">
            <li>
              <TextLink href="/admin/employees">Employees and portal access</TextLink>
            </li>
            <li>
              <TextLink href="/admin/onboarding">Onboarding documents and e-signature</TextLink>
            </li>
            <li>
              <TextLink href="/messages">Messages with employees</TextLink>
            </li>
          </ul>
        </Panel>
        <Panel title="Compliance records" description="Form I-9, E-Verify, STEM OPT, H-1B public access files and green card cases.">
          <ul className="grid gap-3">
            <li>
              <TextLink href="/admin/stem-opt">STEM OPT training plans (Form I-983)</TextLink>
            </li>
            <li>
              <TextLink href="/admin/paf">H-1B public access files</TextLink>
            </li>
            <li>
              <TextLink href="/admin/audit-log">Audit log of sensitive changes</TextLink>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
