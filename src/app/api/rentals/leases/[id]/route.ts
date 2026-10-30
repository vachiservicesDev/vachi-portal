import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalLeases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { todayEastern } from '@/lib/dates';
import { ownedLease } from '@/lib/rentals/access';
import { dec, leaseUpdateSchema } from '@/lib/rentals/schemas';

/** Edits a lease, or ends it (which also stops the tenant seeing it). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await ownedLease(gate.user.id, params.id);
  if (!found) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = leaseUpdateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const { status, endDate, tenantPhone, monthlyRent } = body.data;
  const ending = status === 'ended' && found.lease.status !== 'ended';
  const [lease] = await db
    .update(rentalLeases)
    .set({
      ...(status ? { status } : {}),
      ...(endDate !== undefined ? { endDate: endDate || null } : ending && !found.lease.endDate ? { endDate: todayEastern() } : {}),
      ...(tenantPhone !== undefined ? { tenantPhone: tenantPhone || null } : {}),
      ...(monthlyRent !== undefined ? { monthlyRent: dec(monthlyRent)! } : {}),
      updatedAt: new Date(),
    })
    .where(eq(rentalLeases.id, found.lease.id))
    .returning();

  await logAudit({
    userId: gate.user.id,
    action: ending ? 'rental.lease_ended' : 'rental.lease_updated',
    resourceType: 'rental_lease',
    resourceId: lease.id,
    oldValues: { status: found.lease.status, endDate: found.lease.endDate, monthlyRent: found.lease.monthlyRent },
    newValues: { status: lease.status, endDate: lease.endDate, monthlyRent: lease.monthlyRent },
  });
  return NextResponse.json({ lease });
}
