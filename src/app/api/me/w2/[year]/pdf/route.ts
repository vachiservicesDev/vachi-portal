import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownEmployee } from '@/lib/employees';
import { taxSetupOf } from '@/lib/payroll/setup';
import { validYear, w2PdfResponse } from '@/lib/payroll/w2';

/** The employee's own W-2, once they have agreed to receive it electronically. */
export async function GET(_request: Request, { params }: { params: { year: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const year = validYear(params.year);
  if (!year) return NextResponse.json({ message: 'Unknown tax year' }, { status: 404 });
  const [e] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!e) return NextResponse.json({ message: 'W-2 not found' }, { status: 404 });
  if (!taxSetupOf(e.w4).w2ConsentAt)
    return NextResponse.json(
      {
        message: 'Agree to receive your W-2 electronically first, on the Pay stubs page.',
      },
      { status: 403 },
    );
  return w2PdfResponse(e, year);
}
