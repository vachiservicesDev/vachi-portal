import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, stemOptTrainingPlans } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [row] = await db
    .select({ plan: stemOptTrainingPlans, employeeFirstName: employees.firstName, employeeLastName: employees.lastName, employeeEmail: employees.email })
    .from(stemOptTrainingPlans)
    .innerJoin(employees, eq(employees.id, stemOptTrainingPlans.employeeId))
    .where(eq(stemOptTrainingPlans.id, params.id))
    .limit(1);
  if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({
    plan: { ...row.plan, employeeFirstName: row.employeeFirstName, employeeLastName: row.employeeLastName, employeeEmail: row.employeeEmail },
  });
}

const updateSchema = z.object({
  // An empty string clears the date.
  i983SubmittedAt: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')]).optional(),
  selfEvaluationCompletedAt: z.literal(true).optional(),
  finalEvaluationCompletedAt: z.literal(true).optional(),
  status: z.enum(['active', 'evaluation_due', 'completed', 'terminated'], { errorMap: () => ({ message: 'Choose a status.' }) }).optional(),
  notes: z.string().max(5000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [before] = await db.select().from(stemOptTrainingPlans).where(eq(stemOptTrainingPlans.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const update: Partial<typeof stemOptTrainingPlans.$inferInsert> = { updatedAt: new Date() };
  if (body.data.i983SubmittedAt !== undefined) update.i983SubmittedAt = body.data.i983SubmittedAt || null;
  if (body.data.selfEvaluationCompletedAt && !before.selfEvaluationCompletedAt) update.selfEvaluationCompletedAt = new Date();
  if (body.data.finalEvaluationCompletedAt && !before.finalEvaluationCompletedAt) {
    update.finalEvaluationCompletedAt = new Date();
    update.status = 'completed';
  }
  if (body.data.status) update.status = body.data.status;
  if (body.data.notes !== undefined) update.notes = body.data.notes.trim() || null;

  const [updated] = await db.update(stemOptTrainingPlans).set(update).where(eq(stemOptTrainingPlans.id, params.id)).returning();

  await logAudit({
    userId: gate.user.id,
    action: 'stem_opt.updated',
    resourceType: 'stem_opt_training_plan',
    resourceId: updated.id,
    oldValues: { status: before.status },
    newValues: { status: updated.status },
  });

  return NextResponse.json({ plan: updated });
}
