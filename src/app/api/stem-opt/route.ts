import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, stemOptTrainingPlans } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const createSchema = z.object({
  employeeId: z.string().uuid(),
  employerName: z.string().min(1),
  trainingStartDate: z.string(),
  trainingEndDate: z.string(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const plans = await db
    .select({
      id: stemOptTrainingPlans.id,
      status: stemOptTrainingPlans.status,
      selfEvaluationDueAt: stemOptTrainingPlans.selfEvaluationDueAt,
      finalEvaluationDueAt: stemOptTrainingPlans.finalEvaluationDueAt,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(stemOptTrainingPlans)
    .innerJoin(employees, eq(employees.id, stemOptTrainingPlans.employeeId));

  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const start = new Date(body.data.trainingStartDate);
  const selfEvalDue = new Date(start);
  selfEvalDue.setMonth(selfEvalDue.getMonth() + 12);

  const [plan] = await db
    .insert(stemOptTrainingPlans)
    .values({
      ...body.data,
      selfEvaluationDueAt: selfEvalDue.toISOString().slice(0, 10),
      finalEvaluationDueAt: body.data.trainingEndDate,
    })
    .returning();

  return NextResponse.json({ plan }, { status: 201 });
}
