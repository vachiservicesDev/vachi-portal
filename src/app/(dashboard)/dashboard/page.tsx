import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { i9Records, onboardingSessions, payRuns, payStubs, timesheets, trainingAssignments, trainingTasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';
import { statusOf } from '@/lib/status';
import { Check } from '@/components/ui/Check';
import { Chip, EmptyState, PageHeader, Panel, TextLink, When, formatMoney } from '@/components/ui/ui';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

type Step = { title: string; done: boolean; href: string; detail: string };

/** An employee's home: what to do next, then a summary of their records. */
export default async function EmployeeHomePage() {
  const session = await requireSession();
  const employee = session.employee;
  const firstName = employee?.firstName ?? session.displayName;

  if (!employee) {
    return (
      <>
        <PageHeader eyebrow="Vachi Portal" title={`Welcome, ${firstName}`} />
        <EmptyState title="Your employee record isn’t set up yet">
          HR hasn&apos;t linked an employee record to {session.email}. Once they do, your onboarding, Form I-9, timesheets and pay stubs appear here.
        </EmptyState>
      </>
    );
  }

  const [onboarding, i9, openTraining, recentTimesheets, latestStub] = await Promise.all([
    db.select().from(onboardingSessions).where(eq(onboardingSessions.employeeId, employee.id)).orderBy(desc(onboardingSessions.createdAt)).limit(1),
    db.select().from(i9Records).where(eq(i9Records.employeeId, employee.id)).limit(1),
    db
      .select({ id: trainingAssignments.id, status: trainingAssignments.status, title: trainingTasks.title, dueDate: trainingTasks.dueDate })
      .from(trainingAssignments)
      .innerJoin(trainingTasks, eq(trainingTasks.id, trainingAssignments.taskId))
      .where(and(eq(trainingAssignments.employeeId, employee.id), inArray(trainingAssignments.status, ['assigned', 'in_progress'])))
      .orderBy(trainingTasks.dueDate)
      .limit(5),
    db.select().from(timesheets).where(eq(timesheets.employeeId, employee.id)).orderBy(desc(timesheets.weekStarting)).limit(3),
    db
      .select({ netPay: payStubs.netPay, payDate: payRuns.payDate })
      .from(payStubs)
      .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
      .where(eq(payStubs.employeeId, employee.id))
      .orderBy(desc(payRuns.payDate))
      .limit(1),
  ]);

  const onboardingSession = onboarding[0];
  const i9Record = i9[0];
  const steps: Step[] = [];
  if (onboardingSession && onboardingSession.status !== 'cancelled') {
    steps.push({
      title: 'Sign your onboarding documents',
      done: onboardingSession.status === 'completed',
      href: '/onboarding',
      detail: onboardingSession.status === 'completed' ? 'All signed.' : 'Dropbox Sign emails you each document to sign.',
    });
  }
  if (i9Record) {
    steps.push({
      title: 'Complete Form I-9, Section 1',
      done: i9Record.status !== 'section1_pending',
      href: '/i9',
      detail: i9Record.status === 'section1_pending' ? 'Required by your first day of work.' : 'Submitted. HR completes Section 2.',
    });
  }
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        eyebrow="Vachi Portal"
        title={`Welcome, ${firstName}`}
        lead={remaining ? `You have ${remaining} ${remaining === 1 ? 'thing' : 'things'} to finish.` : 'You’re all caught up.'}
      />

      <div className="grid gap-6">
        {steps.length > 0 && (
          <Panel title="Getting started">
            <ol className="grid gap-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <Link href={s.href} className="group flex items-start gap-4 rounded-lg border border-line p-4 transition-colors hover:border-navy-700">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm ${s.done ? 'bg-green-50 text-green-700' : 'bg-navy-50 text-navy-700'}`}
                    >
                      {s.done ? <Check className="h-4 w-4 text-green-700" /> : String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="font-medium text-ink group-hover:text-navy-700">{s.title}</span>
                        {s.done ? <Chip tone="live">Done</Chip> : <Chip tone="new">To do</Chip>}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{s.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Training" actions={<TextLink href="/training">All training</TextLink>}>
            {openTraining.length === 0 ? (
              <p className="text-ink-2">Nothing assigned right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {openTraining.map((t) => {
                  const s = statusOf('training', t.status);
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <Link href={`/training/${t.id}`} className="font-medium text-ink hover:text-navy-700 hover:underline">
                          {t.title}
                        </Link>
                        {t.dueDate && (
                          <span className="block text-sm text-muted">
                            Due <When iso={t.dueDate} />
                          </span>
                        )}
                      </span>
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Timesheets" actions={<TextLink href="/timesheets">All timesheets</TextLink>}>
            {recentTimesheets.length === 0 ? (
              <p className="text-ink-2">No timesheets yet. Start one for this week from the Timesheets page.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentTimesheets.map((t) => {
                  const s = statusOf('timesheet', t.status);
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <Link href={`/timesheets/${t.id}`} className="min-w-0 font-medium text-ink hover:text-navy-700 hover:underline">
                        Week of <When iso={t.weekStarting} />
                      </Link>
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Pay" actions={<TextLink href="/payroll">All pay stubs</TextLink>}>
            {latestStub[0] ? (
              <p className="text-ink-2">
                Last paid <span className="font-display text-2xl font-semibold text-ink">{formatMoney(latestStub[0].netPay)}</span> net on{' '}
                <When iso={latestStub[0].payDate} />.
              </p>
            ) : (
              <p className="text-ink-2">Your pay stubs appear here after each payroll.</p>
            )}
          </Panel>

          <Panel title="Messages" actions={<TextLink href="/messages">Open messages</TextLink>}>
            <p className="text-ink-2">Questions about your visa, pay or paperwork? Message HR directly from the portal.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
