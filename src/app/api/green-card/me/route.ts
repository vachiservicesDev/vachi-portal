import { ownEmployee } from '@/lib/employees';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, greenCardCases } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(ownEmployee(gate.profile))
    .limit(1);
  if (!employee) return NextResponse.json({ case: null });

  // Notes are HR-only, so they're left out.
  const [gcCase] = await db
    .select({ stage: greenCardCases.stage, priorityDate: greenCardCases.priorityDate, stageUpdatedAt: greenCardCases.stageUpdatedAt })
    .from(greenCardCases)
    .where(eq(greenCardCases.employeeId, employee.id))
    .limit(1);

  return NextResponse.json({ case: gcCase ?? null });
}
