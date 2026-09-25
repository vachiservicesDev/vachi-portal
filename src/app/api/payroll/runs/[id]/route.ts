import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  if (!run) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const stubs = await db
    .select({
      id: payStubs.id,
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
