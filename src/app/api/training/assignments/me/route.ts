import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, trainingAssignments, trainingTasks } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) return NextResponse.json({ assignments: [] });

  const assignments = await db
    .select({
      id: trainingAssignments.id,
      status: trainingAssignments.status,
      assignedAt: trainingAssignments.assignedAt,
      completedAt: trainingAssignments.completedAt,
      score: trainingAssignments.score,
      taskId: trainingTasks.id,
      taskTitle: trainingTasks.title,
      taskType: trainingTasks.type,
      taskPriority: trainingTasks.priority,
      taskDueDate: trainingTasks.dueDate,
      taskIsMandatory: trainingTasks.isMandatory,
      taskContentUrl: trainingTasks.contentUrl,
    })
    .from(trainingAssignments)
    .innerJoin(trainingTasks, eq(trainingTasks.id, trainingAssignments.taskId))
    .where(eq(trainingAssignments.employeeId, employee.id))
    .orderBy(desc(trainingAssignments.assignedAt));

  return NextResponse.json({ assignments });
}
