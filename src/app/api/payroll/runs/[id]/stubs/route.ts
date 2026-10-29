import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { buildStub, stubInputSchema } from '@/lib/payroll/stub';
import { taxSetupOf } from '@/lib/payroll/setup';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = stubInputSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [run] = await db.select({ id: payRuns.id, status: payRuns.status }).from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  if (!run) return NextResponse.json({ message: 'Pay run not found' }, { status: 404 });
  if (run.status === 'processed') return NextResponse.json({ message: 'This pay run is processed. Reopen it to add stubs.' }, { status: 409 });

  const [existing] = await db
    .select({ id: payStubs.id })
    .from(payStubs)
    .where(and(eq(payStubs.payRunId, params.id), eq(payStubs.employeeId, body.data.employeeId)))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { message: 'This employee already has a stub in this pay run.', errors: { fieldErrors: { employeeId: ['Already has a stub in this pay run.'] } } },
      { status: 409 },
    );
  }

  const [employee] = await db.select({ workState: employees.workState, w4: employees.w4 }).from(employees).where(eq(employees.id, body.data.employeeId)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found', errors: { fieldErrors: { employeeId: ['Choose an employee.'] } } }, { status: 400 });

  // The stub shows the filing status and state on file unless HR gave others.
  const built = buildStub({
    ...body.data,
    filingStatus: body.data.filingStatus ?? taxSetupOf(employee.w4).federal?.filingStatus,
    stateCode: body.data.stateCode ?? employee.workState ?? undefined,
  });
  if (built.error) {
    return NextResponse.json({ message: built.error.message, errors: { fieldErrors: { [built.error.field]: [built.error.message] } } }, { status: 400 });
  }

  const [stub] = await db
    .insert(payStubs)
    .values({
      payRunId: params.id,
      employeeId: body.data.employeeId,
      grossPay: String(built.grossPay),
      netPay: String(built.netPay),
      deductions: built.detail,
    })
    .returning();

  return NextResponse.json({ stub }, { status: 201 });
}
