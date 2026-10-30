import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { rentCharges, rentalLeases, rentalProperties, rentalReminders, repairRequests } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { todayEastern } from '@/lib/dates';
import { ownedProperty } from '@/lib/rentals/access';
import { chargeStatus } from '@/lib/rentals/rent';
import { propertySchema } from '@/lib/rentals/schemas';

/** One home with everything on its page: leases, rent ledger, repairs and reminders. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const [leases, repairs, reminders] = await Promise.all([
    db.select().from(rentalLeases).where(eq(rentalLeases.propertyId, property.id)).orderBy(desc(rentalLeases.startDate)),
    db.select().from(repairRequests).where(eq(repairRequests.propertyId, property.id)).orderBy(desc(repairRequests.createdAt)),
    db.select().from(rentalReminders).where(eq(rentalReminders.propertyId, property.id)).orderBy(asc(rentalReminders.dueDate)),
  ]);
  const charges = leases.length
    ? await db.select().from(rentCharges).where(inArray(rentCharges.leaseId, leases.map((l) => l.id))).orderBy(desc(rentCharges.period))
    : [];

  const today = todayEastern();
  const grace = new Map(leases.map((l) => [l.id, l.graceDays]));
  return NextResponse.json({
    property,
    leases,
    charges: charges.map((c) => ({ ...c, status: chargeStatus(c, grace.get(c.leaseId) ?? 0, today) })),
    repairs,
    reminders,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = propertySchema.partial().safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  // A cleared optional field arrives as an empty string; store it as empty (null).
  const values = Object.fromEntries(Object.entries(body.data).map(([k, v]) => [k, v === '' ? null : v]));
  const [updated] = await db
    .update(rentalProperties)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(rentalProperties.id, property.id))
    .returning();
  return NextResponse.json({ property: updated });
}

/** Removes a home and everything under it (leases, rent history, repairs, reminders). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  await db.delete(rentalProperties).where(eq(rentalProperties.id, property.id));
  await logAudit({ userId: gate.user.id, action: 'rental.property_deleted', resourceType: 'rental_property', resourceId: property.id, oldValues: { name: property.name, address: property.address } });
  return NextResponse.json({ ok: true });
}
