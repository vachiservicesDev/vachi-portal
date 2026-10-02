import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { employees, timesheetEntries, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownsEmployee } from '@/lib/employees';
import { EDITABLE, recalcTotals } from '../../shared';

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date you worked.'),
  hours: z.coerce.number().gt(0, 'Enter more than 0 hours.').max(24, 'A day has at most 24 hours.'),
  projectCode: z.string().trim().max(50).optional(),
  taskDescription: z.string().trim().max(2000).optional(),
  isOvertime: z.coerce.boolean().optional(),
});

/** Loads the timesheet and checks the caller may edit it. */
async function editableTimesheet(id: string, profile: { id: string; email: string }) {
  const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1);
  if (!timesheet) return { error: NextResponse.json({ message: 'Not found' }, { status: 404 }) };
  if (!EDITABLE.includes(timesheet.status)) {
    return { error: NextResponse.json({ message: 'Timesheet is no longer editable' }, { status: 400 }) };
  }
  const [employee] = await db.select().from(employees).where(eq(employees.id, timesheet.employeeId)).limit(1);
  if (!ownsEmployee(employee, profile)) return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  return { timesheet };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { timesheet, error } = await editableTimesheet(params.id, gate.profile);
  if (error) return error;

  const body = entrySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  }
  if (body.data.date < timesheet.weekStarting || body.data.date > timesheet.weekEnding) {
    return NextResponse.json(
      { message: 'That date is outside this timesheet’s week.', errors: { fieldErrors: { date: ['Pick a date within this timesheet’s week.'] } } },
      { status: 400 },
    );
  }

  const [entry] = await db
    .insert(timesheetEntries)
    .values({ timesheetId: params.id, ...body.data, hours: String(body.data.hours) })
    .returning();
  await recalcTotals(params.id);

  return NextResponse.json({ entry }, { status: 201 });
}

/** Removes one entry (?entryId=…) from a timesheet that is still editable. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { error } = await editableTimesheet(params.id, gate.profile);
  if (error) return error;

  const entryId = request.nextUrl.searchParams.get('entryId') ?? '';
  if (!z.string().uuid().safeParse(entryId).success) return NextResponse.json({ message: 'entryId is required' }, { status: 400 });

  const deleted = await db
    .delete(timesheetEntries)
    .where(and(eq(timesheetEntries.id, entryId), eq(timesheetEntries.timesheetId, params.id)))
    .returning({ id: timesheetEntries.id });
  if (deleted.length === 0) return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
  await recalcTotals(params.id);

  return NextResponse.json({ ok: true });
}
