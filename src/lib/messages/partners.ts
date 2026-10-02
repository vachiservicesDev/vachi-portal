import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

type Caller = { id: string; role: string };

/**
 * Who a user may message: HR (admins) can message anyone active; employees can message HR only.
 * Names come from the linked employee record when there is one.
 */
export async function listPartners(caller: Caller) {
  const rows = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role, firstName: employees.firstName, lastName: employees.lastName })
    .from(profiles)
    .leftJoin(employees, eq(employees.userId, profiles.id))
    .where(and(ne(profiles.id, caller.id), eq(profiles.isActive, true), caller.role === 'admin' ? undefined : eq(profiles.role, 'admin')));
  return rows;
}

export async function findPartner(caller: Caller, partnerId: string) {
  if (!z.string().uuid().safeParse(partnerId).success || partnerId === caller.id) return null;
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role, isActive: profiles.isActive, firstName: employees.firstName, lastName: employees.lastName })
    .from(profiles)
    .leftJoin(employees, eq(employees.userId, profiles.id))
    .where(eq(profiles.id, partnerId))
    .limit(1);
  if (!row) return null;
  if (caller.role !== 'admin' && row.role !== 'admin') return null;
  return row;
}
