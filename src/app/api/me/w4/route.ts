import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownEmployee } from '@/lib/employees';
import { logAudit } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';
import { employeeFormsSchema, taxSetupOf } from '@/lib/payroll/setup';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** The employee's own federal W-4 (and state form), as on paper. HR is notified. */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const [e] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!e) return NextResponse.json({ message: 'No employee record is linked to this login yet. Ask HR.' }, { status: 404 });
  return NextResponse.json({ workState: e.workState, name: `${e.firstName} ${e.lastName}`, w4: taxSetupOf(e.w4) });
}

export async function PUT(request: NextRequest) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const [e] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!e) return NextResponse.json({ message: 'No employee record is linked to this login yet. Ask HR.' }, { status: 404 });

  const body = employeeFormsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  const before = taxSetupOf(e.w4);
  const { federal, state, ssnLast4, signedName } = body.data;
  const w4 = {
    ...before,
    federal: { ...federal, submittedAt: new Date().toISOString(), submittedBy: 'employee' as const, signedName },
    state: state ?? before.state,
    ssnLast4,
  };
  await db.update(employees).set({ w4, updatedAt: new Date() }).where(eq(employees.id, e.id));

  await logAudit({ userId: gate.user.id, action: 'w4_submitted', resourceType: 'employee', resourceId: e.id, newValues: { filingStatus: w4.federal.filingStatus } });
  const admins = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, 'admin'));
  for (const a of admins) {
    await createNotification({
      userId: a.id,
      type: 'w4_submitted',
      title: `${e.firstName} ${e.lastName} updated their W-4`,
      message: 'Their next pay stub uses the new withholding.',
      actionUrl: `/admin/employees/${e.id}`,
      actionLabel: 'View',
    });
  }
  return NextResponse.json({ w4 });
}
