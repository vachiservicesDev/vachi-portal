import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, i9Records } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { addBusinessDays, toDateOnly } from '@/lib/dates/businessDays';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({ employeeId: z.string().uuid() });

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const records = await db
    .select({
      id: i9Records.id,
      employeeId: i9Records.employeeId,
      status: i9Records.status,
      section2DueAt: i9Records.section2DueAt,
      section3DueAt: i9Records.section3DueAt,
      everifyStatus: i9Records.everifyStatus,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(i9Records)
    .innerJoin(employees, eq(employees.id, i9Records.employeeId))
    .orderBy(desc(i9Records.createdAt));

  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'employeeId is required' }, { status: 400 });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, body.data.employeeId))
    .limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const [existing] = await db
    .select()
    .from(i9Records)
    .where(eq(i9Records.employeeId, employee.id))
    .limit(1);
  if (existing) {
    return NextResponse.json({ message: 'I-9 record already exists for this employee' }, {
      status: 409,
    });
  }

  const hireDate = employee.startDate ?? toDateOnly(new Date());
  const section2DueAt = toDateOnly(addBusinessDays(new Date(hireDate), 3));
  // Section 3 reverification only applies when work authorization itself
  // expires (aliens authorized to work) - visaExpiryDate is the closest
  // proxy available on the employee record today.
  const section3DueAt = employee.visaExpiryDate;

  const [record] = await db
    .insert(i9Records)
    .values({
      employeeId: employee.id,
      status: 'section1_pending',
      section2DueAt,
      section3DueAt,
    })
    .returning();

  return NextResponse.json({ record }, { status: 201 });
}
