import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, trainingAssignments, trainingTasks } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [task] = await db.select().from(trainingTasks).where(eq(trainingTasks.id, params.id)).limit(1);
  if (!task) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const assignments = await db
    .select({
      id: trainingAssignments.id,
      status: trainingAssignments.status,
      score: trainingAssignments.score,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(trainingAssignments)
    .innerJoin(employees, eq(employees.id, trainingAssignments.employeeId))
    .where(eq(trainingAssignments.taskId, task.id));

  return NextResponse.json({ task, assignments });
}
