import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { loadStatement } from '@/lib/payroll/load';

/** One pay stub with every line and its year-to-date total, for the employee or HR. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await loadStatement(params.id, gate.profile);
  if (!found) return NextResponse.json({ message: 'Pay stub not found' }, { status: 404 });
  const { stub, run, employee, company, statement } = found;
  return NextResponse.json({
    stub: { id: stub.id, payDate: run.payDate, payPeriodStart: run.payPeriodStart, payPeriodEnd: run.payPeriodEnd, runStatus: run.status },
    employee: { firstName: employee.firstName, lastName: employee.lastName, address: employee.address },
    company: company.name,
    statement,
  });
}
