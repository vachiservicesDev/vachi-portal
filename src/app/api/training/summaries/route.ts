import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, weeklyTrainingSummaries } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({
  weekStarting: z.string(),
  weekEnding: z.string(),
  content: z.string().min(1),
  submit: z.coerce.boolean().optional(), // false/omitted = save as draft
});

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (gate.profile.role === 'admin') {
    const summaries = await db
      .select({
        id: weeklyTrainingSummaries.id,
        weekStarting: weeklyTrainingSummaries.weekStarting,
        weekEnding: weeklyTrainingSummaries.weekEnding,
        content: weeklyTrainingSummaries.content,
        status: weeklyTrainingSummaries.status,
        reviewComments: weeklyTrainingSummaries.reviewComments,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(weeklyTrainingSummaries)
      .innerJoin(employees, eq(employees.id, weeklyTrainingSummaries.employeeId))
      .orderBy(desc(weeklyTrainingSummaries.weekStarting));
    return NextResponse.json({ summaries });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) return NextResponse.json({ summaries: [] });

  const summaries = await db
    .select()
    .from(weeklyTrainingSummaries)
    .where(eq(weeklyTrainingSummaries.employeeId, employee.id))
    .orderBy(desc(weeklyTrainingSummaries.weekStarting));

  return NextResponse.json({ summaries });
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
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const { submit, ...rest } = body.data;

  const [summary] = await db
    .insert(weeklyTrainingSummaries)
    .values({
      employeeId: employee.id,
      ...rest,
      status: submit ? 'submitted' : 'draft',
      submittedAt: submit ? new Date() : undefined,
    })
    .returning();

  return NextResponse.json({ summary }, { status: 201 });
}
