import { ownEmployee } from '@/lib/employees';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, weeklyTrainingSummaries } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { and, desc, eq, ne } from 'drizzle-orm';

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const summaryFields = {
  content: z.string().trim().min(1, 'Write what you worked on this week.').max(20000),
  submit: z.boolean().optional(), // false/omitted = save as draft
};
const createSchema = z
  .object({ weekStarting: day('Enter the first day of the week.'), weekEnding: day('Enter the last day of the week.'), ...summaryFields })
  .refine((v) => v.weekEnding >= v.weekStarting, { message: 'The week must end on or after it starts.', path: ['weekEnding'] });

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
        submittedAt: weeklyTrainingSummaries.submittedAt,
        reviewedAt: weeklyTrainingSummaries.reviewedAt,
        reviewComments: weeklyTrainingSummaries.reviewComments,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(weeklyTrainingSummaries)
      .innerJoin(employees, eq(employees.id, weeklyTrainingSummaries.employeeId))
      // Drafts are the employee's own working copy.
      .where(ne(weeklyTrainingSummaries.status, 'draft'))
      .orderBy(desc(weeklyTrainingSummaries.weekStarting));
    return NextResponse.json({ summaries });
  }

  const [employee] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
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

  const [employee] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Your account isn’t linked to an employee record yet. Ask HR to link it.' }, { status: 400 });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [existing] = await db
    .select({ id: weeklyTrainingSummaries.id })
    .from(weeklyTrainingSummaries)
    .where(and(eq(weeklyTrainingSummaries.employeeId, employee.id), eq(weeklyTrainingSummaries.weekStarting, body.data.weekStarting)))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { message: 'You already have a summary for this week. Edit that one instead.', errors: { fieldErrors: { weekStarting: ['Already has a summary.'] } } },
      { status: 409 },
    );
  }

  const { submit, ...rest } = body.data;
  const [summary] = await db
    .insert(weeklyTrainingSummaries)
    .values({ employeeId: employee.id, ...rest, status: submit ? 'submitted' : 'draft', submittedAt: submit ? new Date() : undefined })
    .returning();

  return NextResponse.json({ summary }, { status: 201 });
}
