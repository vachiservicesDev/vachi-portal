import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalLeases, rentalProperties, rentalReminders } from '@/db/schema';

/** A property, only when it belongs to `ownerId`. Every landlord route goes through this. */
export async function ownedProperty(ownerId: string, propertyId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return null;
  const [row] = await db
    .select()
    .from(rentalProperties)
    .where(and(eq(rentalProperties.id, propertyId), eq(rentalProperties.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** A lease and its property, only when the property belongs to `ownerId`. */
export async function ownedLease(ownerId: string, leaseId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(leaseId)) return null;
  const [row] = await db
    .select({ lease: rentalLeases, property: rentalProperties })
    .from(rentalLeases)
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalLeases.propertyId))
    .where(and(eq(rentalLeases.id, leaseId), eq(rentalProperties.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/** The signed-in tenant's current lease (the newest active one) and its property. */
export async function tenantLease(userId: string) {
  const [row] = await db
    .select({ lease: rentalLeases, property: rentalProperties })
    .from(rentalLeases)
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalLeases.propertyId))
    .where(and(eq(rentalLeases.tenantUserId, userId), eq(rentalLeases.status, 'active')))
    .orderBy(desc(rentalLeases.startDate))
    .limit(1);
  return row ?? null;
}

/** A reminder, only when its home belongs to the caller. */
export async function ownedReminder(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ reminder: rentalReminders })
    .from(rentalReminders)
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalReminders.propertyId))
    .where(and(eq(rentalReminders.id, id), eq(rentalProperties.ownerId, ownerId)))
    .limit(1);
  return row?.reminder ?? null;
}
