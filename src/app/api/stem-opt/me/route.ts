import { ownEmployee } from '@/lib/employees';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, stemOptTrainingPlans } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(ownEmployee(gate.profile))
    .limit(1);
  if (!employee) return NextResponse.json({ plan: null });

  // Notes are HR-only, so they're left out.
  const [plan] = await db
    .select({
      status: stemOptTrainingPlans.status,
      employerName: stemOptTrainingPlans.employerName,
      trainingStartDate: stemOptTrainingPlans.trainingStartDate,
      trainingEndDate: stemOptTrainingPlans.trainingEndDate,
      i983SubmittedAt: stemOptTrainingPlans.i983SubmittedAt,
      selfEvaluationDueAt: stemOptTrainingPlans.selfEvaluationDueAt,
      selfEvaluationCompletedAt: stemOptTrainingPlans.selfEvaluationCompletedAt,
      finalEvaluationDueAt: stemOptTrainingPlans.finalEvaluationDueAt,
      finalEvaluationCompletedAt: stemOptTrainingPlans.finalEvaluationCompletedAt,
    })
    .from(stemOptTrainingPlans)
    .where(eq(stemOptTrainingPlans.employeeId, employee.id))
    .limit(1);

  return NextResponse.json({ plan: plan ?? null });
}
