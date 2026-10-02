import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, greenCardCases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({
  employeeId: z.string().uuid('Choose an employee.'),
  priorityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').optional(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const cases = await db
    .select({
      id: greenCardCases.id,
      employeeId: greenCardCases.employeeId,
      stage: greenCardCases.stage,
      priorityDate: greenCardCases.priorityDate,
      stageUpdatedAt: greenCardCases.stageUpdatedAt,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(greenCardCases)
    .innerJoin(employees, eq(employees.id, greenCardCases.employeeId))
    .orderBy(desc(greenCardCases.stageUpdatedAt));

  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.data.employeeId)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  // One case per employee (employee_id is unique).
  const [existing] = await db.select({ id: greenCardCases.id }).from(greenCardCases).where(eq(greenCardCases.employeeId, body.data.employeeId)).limit(1);
  if (existing) {
    return NextResponse.json(
      { message: 'This employee already has a green card case.', errors: { fieldErrors: { employeeId: ['Already has a case.'] } } },
      { status: 409 },
    );
  }

  const [gcCase] = await db.insert(greenCardCases).values(body.data).returning();
  return NextResponse.json({ case: gcCase }, { status: 201 });
}
