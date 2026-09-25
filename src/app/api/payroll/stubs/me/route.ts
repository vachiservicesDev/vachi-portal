import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) return NextResponse.json({ stubs: [] });

  const stubs = await db
    .select({
      id: payStubs.id,
      grossPay: payStubs.grossPay,
      netPay: payStubs.netPay,
      payDate: payRuns.payDate,
      payPeriodStart: payRuns.payPeriodStart,
      payPeriodEnd: payRuns.payPeriodEnd,
    })
    .from(payStubs)
    .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
    .where(eq(payStubs.employeeId, employee.id))
    .orderBy(desc(payRuns.payDate));

  return NextResponse.json({ stubs });
}
