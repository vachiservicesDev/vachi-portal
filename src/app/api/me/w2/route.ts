import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownEmployee } from '@/lib/employees';
import { logAudit } from '@/lib/audit/log';
import { taxSetupOf } from '@/lib/payroll/setup';
import { w2sFor } from '@/lib/payroll/w2';

/** The employee's W-2 figures for each year they were paid, and whether they agreed to electronic W-2s. */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const [e] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!e) return NextResponse.json({ consentAt: null, w2s: [] });
  return NextResponse.json({
    consentAt: taxSetupOf(e.w4).w2ConsentAt ?? null,
    currentYear: new Date().getUTCFullYear(),
    w2s: await w2sFor(e),
  });
}

/** The IRS requires an employee's consent before their W-2 is furnished electronically. */
export async function POST(request: NextRequest) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const [e] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!e) return NextResponse.json({ message: 'No employee record is linked to this login yet. Ask HR.' }, { status: 404 });
  const body = z.object({ consent: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const before = taxSetupOf(e.w4);
  const w4 = {
    ...before,
    w2ConsentAt: body.data.consent ? new Date().toISOString() : undefined,
  };
  await db.update(employees).set({ w4, updatedAt: new Date() }).where(eq(employees.id, e.id));
  await logAudit({
    userId: gate.user.id,
    action: body.data.consent ? 'w2_electronic_consent' : 'w2_electronic_consent_withdrawn',
    resourceType: 'employee',
    resourceId: e.id,
  });
  return NextResponse.json({ consentAt: w4.w2ConsentAt ?? null });
}
