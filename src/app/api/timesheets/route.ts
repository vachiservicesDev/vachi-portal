import { ownEmployee } from '@/lib/employees';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { and, desc, eq } from 'drizzle-orm';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date.');
const createSchema = z
  .object({ weekStarting: day, weekEnding: day })
  .refine((v) => v.weekEnding >= v.weekStarting, { message: 'The week must end on or after the day it starts.', path: ['weekEnding'] })
  .refine((v) => (Date.parse(v.weekEnding) - Date.parse(v.weekStarting)) / 86_400_000 <= 13, {
    message: 'A timesheet covers up to two weeks.',
    path: ['weekEnding'],
  });

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (gate.profile.role === 'admin') {
    const rows = await db
      .select({
        id: timesheets.id,
        weekStarting: timesheets.weekStarting,
        weekEnding: timesheets.weekEnding,
        totalHours: timesheets.totalHours,
        status: timesheets.status,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(timesheets)
      .innerJoin(employees, eq(employees.id, timesheets.employeeId))
      .orderBy(desc(timesheets.weekStarting));
    return NextResponse.json({ timesheets: rows });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(ownEmployee(gate.profile))
    .limit(1);
  if (!employee) return NextResponse.json({ timesheets: [] });

  const rows = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.employeeId, employee.id))
    .orderBy(desc(timesheets.weekStarting));

  return NextResponse.json({ timesheets: rows });
}

export async function POST(request: NextRequest) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(ownEmployee(gate.profile))
    .limit(1);
  if (!employee) {
    return NextResponse.json({ message: 'No employee record linked to this account' }, {
      status: 400,
    });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [duplicate] = await db
    .select({ id: timesheets.id })
    .from(timesheets)
    .where(and(eq(timesheets.employeeId, employee.id), eq(timesheets.weekStarting, body.data.weekStarting)))
    .limit(1);
  if (duplicate) {
    return NextResponse.json(
      { message: 'You already have a timesheet for that week.', id: duplicate.id, errors: { fieldErrors: { weekStarting: ['You already have a timesheet for that week.'] } } },
      { status: 409 },
    );
  }

  const [timesheet] = await db
    .insert(timesheets)
    .values({ employeeId: employee.id, ...body.data, status: 'draft' })
    .returning();

  return NextResponse.json({ timesheet }, { status: 201 });
}
