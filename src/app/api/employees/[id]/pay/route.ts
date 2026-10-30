import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { findEmployee } from '@/lib/employees';
import { logAudit } from '@/lib/audit/log';
import { paySetupSchema, taxSetupOf } from '@/lib/payroll/setup';
import { eq } from 'drizzle-orm';

/** HR saves how an employee is paid and taxed. Pay stubs are filled from this. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const employee = await findEmployee(params.id);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const body = paySetupSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  const d = body.data;
  const before = taxSetupOf(employee.w4);
  const w4 = {
    federal: d.federal ? { ...d.federal, submittedAt: new Date().toISOString(), submittedBy: 'hr' as const } : before.federal,
    state: d.state ?? before.state,
  };

  const [updated] = await db
    .update(employees)
    .set({
      payType: d.payType,
      payRate: d.payType === 'hourly' && d.payRate ? String(d.payRate) : null,
      annualSalary: d.payType === 'salary' && d.annualSalary ? String(d.annualSalary) : null,
      payFrequency: d.payFrequency,
      workState: d.workState,
      w4,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employee.id))
    .returning();

  await logAudit({
    userId: gate.user.id,
    action: 'employee_pay_updated',
    resourceType: 'employee',
    resourceId: employee.id,
    oldValues: { payType: employee.payType, payRate: employee.payRate, annualSalary: employee.annualSalary, payFrequency: employee.payFrequency, workState: employee.workState },
    newValues: { payType: updated.payType, payRate: updated.payRate, annualSalary: updated.annualSalary, payFrequency: updated.payFrequency, workState: updated.workState, w4Changed: !!d.federal || !!d.state },
  });
  return NextResponse.json({ employee: updated });
}
