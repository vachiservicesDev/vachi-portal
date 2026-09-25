import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, timesheetEntries, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { asc, eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, params.id)).limit(1);
  if (!timesheet) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  if (gate.profile.role !== 'admin') {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, timesheet.employeeId))
      .limit(1);
    if (!employee || employee.email !== gate.profile.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  const entries = await db
    .select()
    .from(timesheetEntries)
    .where(eq(timesheetEntries.timesheetId, params.id))
    .orderBy(asc(timesheetEntries.date));

  return NextResponse.json({ timesheet, entries });
}
