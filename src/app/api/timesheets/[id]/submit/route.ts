import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, timesheetEntries, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, params.id)).limit(1);
  if (!timesheet) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, timesheet.employeeId))
    .limit(1);
  if (!employee || employee.email !== gate.profile.email) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const entries = await db
    .select()
    .from(timesheetEntries)
    .where(eq(timesheetEntries.timesheetId, params.id));

  if (entries.length === 0) {
    return NextResponse.json({ message: 'Add at least one entry before submitting' }, {
      status: 400,
    });
  }

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const overtimeHours = entries
    .filter((e) => e.isOvertime)
    .reduce((sum, e) => sum + Number(e.hours), 0);

  const [updated] = await db
    .update(timesheets)
    .set({
      totalHours: String(totalHours),
      overtimeHours: String(overtimeHours),
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, params.id))
    .returning();

  return NextResponse.json({ timesheet: updated });
}
