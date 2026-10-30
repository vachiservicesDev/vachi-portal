import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { findEmployee } from '@/lib/employees';
import { validYear, w2PdfResponse } from '@/lib/payroll/w2';

/** Any employee's W-2, for HR to print, mail or check. */
export async function GET(_request: Request, { params }: { params: { employeeId: string; year: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const year = validYear(params.year);
  const employee = year ? await findEmployee(params.employeeId) : null;
  if (!year || !employee) return NextResponse.json({ message: 'W-2 not found' }, { status: 404 });
  return w2PdfResponse(employee, year);
}
