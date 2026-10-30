import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalLeases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { ownedProperty } from '@/lib/rentals/access';
import { dec, leaseSchema } from '@/lib/rentals/schemas';

/** Starts a lease on a home. A home has at most one active lease; end the old one first. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = leaseSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [current] = await db
    .select({ id: rentalLeases.id })
    .from(rentalLeases)
    .where(and(eq(rentalLeases.propertyId, property.id), eq(rentalLeases.status, 'active')))
    .limit(1);
  if (current) return NextResponse.json({ message: 'This home already has an active lease. End it before adding a new one.' }, { status: 409 });

  const d = body.data;
  const [lease] = await db
    .insert(rentalLeases)
    .values({
      propertyId: property.id,
      tenantName: d.tenantName,
      tenantEmail: d.tenantEmail,
      tenantPhone: d.tenantPhone,
      startDate: d.startDate,
      endDate: d.endDate,
      monthlyRent: dec(d.monthlyRent)!,
      dueDay: d.dueDay,
      graceDays: d.graceDays,
      lateFee: dec(d.lateFee),
      securityDeposit: dec(d.securityDeposit),
    })
    .returning();

  await logAudit({ userId: gate.user.id, action: 'rental.lease_created', resourceType: 'rental_lease', resourceId: lease.id, newValues: { propertyId: property.id, tenantEmail: lease.tenantEmail, monthlyRent: lease.monthlyRent } });
  return NextResponse.json({ lease }, { status: 201 });
}
