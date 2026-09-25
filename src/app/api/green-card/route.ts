import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, greenCardCases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const createSchema = z.object({ employeeId: z.string().uuid(), priorityDate: z.string().optional() });

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const cases = await db
    .select({
      id: greenCardCases.id,
      stage: greenCardCases.stage,
      priorityDate: greenCardCases.priorityDate,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(greenCardCases)
    .innerJoin(employees, eq(employees.id, greenCardCases.employeeId));

  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'employeeId is required' }, { status: 400 });

  const [gcCase] = await db.insert(greenCardCases).values(body.data).returning();
  return NextResponse.json({ case: gcCase }, { status: 201 });
}
