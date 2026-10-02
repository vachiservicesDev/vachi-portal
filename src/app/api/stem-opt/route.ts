import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, stemOptTrainingPlans } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { asc, eq } from 'drizzle-orm';
import { addMonths } from '@/lib/dates';

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

const createSchema = z
  .object({
    employeeId: z.string().uuid('Choose an employee.'),
    employerName: z.string().trim().min(1, 'Enter the employer name.').max(255),
    trainingStartDate: day('Enter the training start date.'),
    trainingEndDate: day('Enter the training end date.'),
    i983SubmittedAt: day('Enter a valid date.').optional(),
  })
  .refine((v) => v.trainingEndDate > v.trainingStartDate, { message: 'The end date must be after the start date.', path: ['trainingEndDate'] })
  .refine((v) => v.trainingEndDate <= addMonths(v.trainingStartDate, 24), {
    message: 'A STEM OPT extension lasts at most 24 months.',
    path: ['trainingEndDate'],
  });

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const plans = await db
    .select({
      id: stemOptTrainingPlans.id,
      employeeId: stemOptTrainingPlans.employeeId,
      status: stemOptTrainingPlans.status,
      employerName: stemOptTrainingPlans.employerName,
      selfEvaluationDueAt: stemOptTrainingPlans.selfEvaluationDueAt,
      selfEvaluationCompletedAt: stemOptTrainingPlans.selfEvaluationCompletedAt,
      finalEvaluationDueAt: stemOptTrainingPlans.finalEvaluationDueAt,
      finalEvaluationCompletedAt: stemOptTrainingPlans.finalEvaluationCompletedAt,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(stemOptTrainingPlans)
    .innerJoin(employees, eq(employees.id, stemOptTrainingPlans.employeeId))
    .orderBy(asc(stemOptTrainingPlans.selfEvaluationDueAt));

  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.data.employeeId)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  // One plan per employee (employee_id is unique).
  const [existing] = await db
    .select({ id: stemOptTrainingPlans.id })
    .from(stemOptTrainingPlans)
    .where(eq(stemOptTrainingPlans.employeeId, body.data.employeeId))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { message: 'This employee already has a STEM OPT plan.', errors: { fieldErrors: { employeeId: ['Already has a plan.'] } } },
      { status: 409 },
    );
  }

  const [plan] = await db
    .insert(stemOptTrainingPlans)
    .values({
      ...body.data,
      selfEvaluationDueAt: addMonths(body.data.trainingStartDate, 12),
      finalEvaluationDueAt: body.data.trainingEndDate,
    })
    .returning();

  return NextResponse.json({ plan }, { status: 201 });
}
