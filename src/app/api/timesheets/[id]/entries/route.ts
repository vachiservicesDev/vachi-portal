import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, timesheetEntries, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const entrySchema = z.object({
  date: z.string(),
  hours: z.coerce.number().min(0).max(24),
  projectCode: z.string().optional(),
  taskDescription: z.string().optional(),
  isOvertime: z.coerce.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [timesheet] = await db.select().from(timesheets).where(eq(timesheets.id, params.id)).limit(1);
  if (!timesheet) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (timesheet.status !== 'draft') {
    return NextResponse.json({ message: 'Timesheet is no longer editable' }, { status: 400 });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, timesheet.employeeId))
    .limit(1);
  if (!employee || employee.email !== gate.profile.email) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = entrySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [entry] = await db
    .insert(timesheetEntries)
    .values({ timesheetId: params.id, ...body.data, hours: String(body.data.hours) })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
