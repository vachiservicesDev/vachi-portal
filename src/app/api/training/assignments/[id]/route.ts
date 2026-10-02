import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { trainingAssignments, trainingTasks } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { loadAssignmentForCaller } from '@/lib/training/access';
import { eq } from 'drizzle-orm';

// Employees move their own training forward; only HR records a score or a failure.
const employeeSchema = z.object({
  status: z.enum(['in_progress', 'completed']).optional(),
  timeSpentMinutes: z.coerce.number().int().min(0, 'Time can’t be negative.').max(100_000).optional(),
});
const adminSchema = employeeSchema.extend({
  status: z.enum(['assigned', 'in_progress', 'completed', 'failed', 'expired']).optional(),
  score: z.coerce.number().int().min(0, 'Score is 0 to 100.').max(100, 'Score is 0 to 100.').optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, employee, allowed } = await loadAssignmentForCaller(params.id, gate.profile);
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [task] = await db.select().from(trainingTasks).where(eq(trainingTasks.id, assignment.taskId)).limit(1);

  return NextResponse.json({ assignment, task, employee: { id: employee!.id, firstName: employee!.firstName, lastName: employee!.lastName },
    viewerIsAdmin: gate.profile.role === 'admin',
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, allowed } = await loadAssignmentForCaller(params.id, gate.profile);
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const isAdmin = gate.profile.role === 'admin';
  const body = (isAdmin ? adminSchema : employeeSchema).safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  if (!isAdmin && ['completed', 'failed', 'expired'].includes(assignment.status)) {
    return NextResponse.json({ message: 'This training is closed. Ask HR if it needs to be reopened.' }, { status: 409 });
  }

  const data = body.data as z.infer<typeof adminSchema>;
  const update: Partial<typeof trainingAssignments.$inferInsert> = { updatedAt: new Date() };
  if (data.status && data.status !== assignment.status) {
    update.status = data.status;
    if (data.status === 'in_progress' && !assignment.startedAt) update.startedAt = new Date();
    if (data.status === 'completed') {
      update.completedAt = new Date();
      if (!assignment.startedAt) update.startedAt = new Date();
    } else {
      update.completedAt = null;
    }
  }
  if (data.score !== undefined) update.score = data.score;
  if (data.timeSpentMinutes !== undefined) update.timeSpentMinutes = data.timeSpentMinutes;

  const [updated] = await db.update(trainingAssignments).set(update).where(eq(trainingAssignments.id, params.id)).returning();

  return NextResponse.json({ assignment: updated });
}
