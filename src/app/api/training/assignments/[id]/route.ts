import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, trainingAssignments, trainingTasks } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const updateSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'failed']).optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  timeSpentMinutes: z.coerce.number().int().min(0).optional(),
});

async function loadAssignmentForCaller(assignmentId: string, callerEmail: string, isAdmin: boolean) {
  const [assignment] = await db
    .select()
    .from(trainingAssignments)
    .where(eq(trainingAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) return { assignment: null, allowed: false };

  if (isAdmin) return { assignment, allowed: true };

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, assignment.employeeId))
    .limit(1);
  return { assignment, allowed: employee?.email === callerEmail };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, allowed } = await loadAssignmentForCaller(
    params.id,
    gate.profile.email,
    gate.profile.role === 'admin',
  );
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [task] = await db.select().from(trainingTasks).where(eq(trainingTasks.id, assignment.taskId)).limit(1);

  return NextResponse.json({ assignment, task });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, allowed } = await loadAssignmentForCaller(
    params.id,
    gate.profile.email,
    gate.profile.role === 'admin',
  );
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const update: Partial<typeof trainingAssignments.$inferInsert> = { updatedAt: new Date() };
  if (body.data.status) {
    update.status = body.data.status;
    if (body.data.status === 'in_progress' && !assignment.startedAt) update.startedAt = new Date();
    if (body.data.status === 'completed') update.completedAt = new Date();
  }
  if (body.data.score !== undefined) update.score = body.data.score;
  if (body.data.timeSpentMinutes !== undefined) update.timeSpentMinutes = body.data.timeSpentMinutes;

  const [updated] = await db
    .update(trainingAssignments)
    .set(update)
    .where(eq(trainingAssignments.id, params.id))
    .returning();

  return NextResponse.json({ assignment: updated });
}
