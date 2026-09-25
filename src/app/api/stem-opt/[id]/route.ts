import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { stemOptTrainingPlans } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [plan] = await db
    .select()
    .from(stemOptTrainingPlans)
    .where(eq(stemOptTrainingPlans.id, params.id))
    .limit(1);
  if (!plan) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({ plan });
}

const updateSchema = z.object({
  i983SubmittedAt: z.string().optional(),
  selfEvaluationCompletedAt: z.coerce.boolean().optional(),
  finalEvaluationCompletedAt: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const update: Partial<typeof stemOptTrainingPlans.$inferInsert> = { updatedAt: new Date() };
  if (body.data.i983SubmittedAt) update.i983SubmittedAt = body.data.i983SubmittedAt;
  if (body.data.selfEvaluationCompletedAt) update.selfEvaluationCompletedAt = new Date();
  if (body.data.finalEvaluationCompletedAt) {
    update.finalEvaluationCompletedAt = new Date();
    update.status = 'completed';
  }
  if (body.data.notes !== undefined) update.notes = body.data.notes;

  const [updated] = await db
    .update(stemOptTrainingPlans)
    .set(update)
    .where(eq(stemOptTrainingPlans.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ plan: updated });
}
