import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { payRuns, payStubs } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { and, eq } from 'drizzle-orm';

/** Removes a stub from a draft pay run, so HR can correct it before processing. */
export async function DELETE(_request: Request, { params }: { params: { id: string; stubId: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  if (!z.string().uuid().safeParse(params.id).success || !z.string().uuid().safeParse(params.stubId).success) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const [run] = await db.select({ status: payRuns.status }).from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  if (!run) return NextResponse.json({ message: 'Pay run not found' }, { status: 404 });
  if (run.status === 'processed') return NextResponse.json({ message: 'This pay run is processed. Reopen it to change stubs.' }, { status: 409 });

  const [removed] = await db
    .delete(payStubs)
    .where(and(eq(payStubs.id, params.stubId), eq(payStubs.payRunId, params.id)))
    .returning();
  if (!removed) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  await logAudit({
    userId: gate.user.id,
    action: 'pay_stub.removed',
    resourceType: 'pay_stub',
    resourceId: removed.id,
    oldValues: { employeeId: removed.employeeId, grossPay: removed.grossPay, netPay: removed.netPay },
  });
  return NextResponse.json({ ok: true });
}
