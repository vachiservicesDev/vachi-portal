import { db } from '@/db';
import { employees, trainingAssignments } from '@/db/schema';
import { ownsEmployee } from '@/lib/employees';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/** The assignment, and whether this caller may see it (admins, or the assigned employee). */
export async function loadAssignmentForCaller(assignmentId: string, profile: { id: string; email: string; role: string }) {
  if (!z.string().uuid().safeParse(assignmentId).success) return { assignment: null, employee: null, allowed: false };
  const [row] = await db
    .select({ assignment: trainingAssignments, employee: employees })
    .from(trainingAssignments)
    .innerJoin(employees, eq(employees.id, trainingAssignments.employeeId))
    .where(eq(trainingAssignments.id, assignmentId))
    .limit(1);
  if (!row) return { assignment: null, employee: null, allowed: false };
  return { assignment: row.assignment, employee: row.employee, allowed: profile.role === 'admin' || ownsEmployee(row.employee, profile) };
}
