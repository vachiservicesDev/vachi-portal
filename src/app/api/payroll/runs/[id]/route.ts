import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  if (!run) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const stubs = await db
    .select({
      id: payStubs.id,
      employeeId: payStubs.employeeId,
      grossPay: payStubs.grossPay,
      netPay: payStubs.netPay,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(payStubs)
    .innerJoin(employees, eq(employees.id, payStubs.employeeId))
    .where(eq(payStubs.payRunId, params.id));

  return NextResponse.json({ run, stubs });
}

const updateSchema = z.object({ status: z.enum(['draft', 'processed']) });

/** Marks a run processed (locks it) or reopens it as a draft. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  if (body.data.status === 'processed') {
    const [stub] = await db.select({ id: payStubs.id }).from(payStubs).where(eq(payStubs.payRunId, params.id)).limit(1);
    if (!stub) return NextResponse.json({ message: 'Add at least one pay stub before marking the run processed.' }, { status: 409 });
  }

  const [run] = await db.update(payRuns).set({ status: body.data.status, updatedAt: new Date() }).where(eq(payRuns.id, params.id)).returning();
  if (!run) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  await logAudit({ userId: gate.user.id, action: `pay_run.${body.data.status}`, resourceType: 'pay_run', resourceId: run.id, newValues: { status: run.status } });
  return NextResponse.json({ run });
}
