import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, timesheets } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({ weekStarting: z.string(), weekEnding: z.string() });

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
    .where(eq(employees.email, gate.profile.email))
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
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) {
    return NextResponse.json({ message: 'No employee record linked to this account' }, {
      status: 400,
    });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const [timesheet] = await db
    .insert(timesheets)
    .values({ employeeId: employee.id, ...body.data, status: 'draft' })
    .returning();

  return NextResponse.json({ timesheet }, { status: 201 });
}
