import { db } from '@/db';
import { employees, onboardingDocuments, onboardingSessions } from '@/db/schema';
import { ownsEmployee } from '@/lib/employees';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Loads an onboarding document with its session and employee, for an admin or for the employee
 * it belongs to. Anyone else gets the same "not found" as a missing id, so ids can't be probed.
 */
export async function loadOwnDocument(id: string, profile: { id: string; email: string; role: string }) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [document] = await db.select().from(onboardingDocuments).where(eq(onboardingDocuments.id, id)).limit(1);
  if (!document) return null;
  const [session] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, document.sessionId)).limit(1);
  if (!session) return null;
  const [employee] = await db.select().from(employees).where(eq(employees.id, session.employeeId)).limit(1);
  if (!employee) return null;
  if (profile.role !== 'admin' && !ownsEmployee(employee, profile)) return null;
  return { document, session, employee };
}
