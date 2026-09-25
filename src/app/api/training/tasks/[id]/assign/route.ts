import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { trainingAssignments, trainingTasks } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { and, eq, inArray } from 'drizzle-orm';

const assignSchema = z.object({ employeeIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [task] = await db.select().from(trainingTasks).where(eq(trainingTasks.id, params.id)).limit(1);
  if (!task) return NextResponse.json({ message: 'Task not found' }, { status: 404 });

  const body = assignSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'employeeIds is required' }, { status: 400 });
  }

  // Skip employees already assigned to this task (idempotent bulk-assign).
  const existing = await db
    .select({ employeeId: trainingAssignments.employeeId })
    .from(trainingAssignments)
    .where(
      and(
        eq(trainingAssignments.taskId, task.id),
        inArray(trainingAssignments.employeeId, body.data.employeeIds),
      ),
    );
  const alreadyAssigned = new Set(existing.map((e) => e.employeeId));
  const toAssign = body.data.employeeIds.filter((id) => !alreadyAssigned.has(id));

  if (toAssign.length === 0) {
    return NextResponse.json({ assignments: [] });
  }

  const assignments = await db
    .insert(trainingAssignments)
    .values(toAssign.map((employeeId) => ({ taskId: task.id, employeeId })))
    .returning();

  return NextResponse.json({ assignments }, { status: 201 });
}
