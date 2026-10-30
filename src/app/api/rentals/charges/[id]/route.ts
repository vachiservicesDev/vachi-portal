import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentCharges, rentalLeases, rentalProperties } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';
import { todayEastern } from '@/lib/dates';
import { monthName, usdText } from '@/lib/rentals/rent';
import { dec, paymentSchema } from '@/lib/rentals/schemas';

/** Records what the tenant has paid toward one month (the running total, not an increment). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const [found] = await db
    .select({ charge: rentCharges, lease: rentalLeases })
    .from(rentCharges)
    .innerJoin(rentalLeases, eq(rentalLeases.id, rentCharges.leaseId))
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalLeases.propertyId))
    .where(and(eq(rentCharges.id, params.id), eq(rentalProperties.ownerId, gate.user.id)))
    .limit(1);
  if (!found) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = paymentSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const { paidAmount, paidOn, paymentMethod, note } = body.data;
  const [charge] = await db
    .update(rentCharges)
    .set({
      paidAmount: dec(paidAmount)!,
      paidOn: paidAmount > 0 ? (paidOn ?? todayEastern()) : null,
      paymentMethod: paidAmount > 0 ? (paymentMethod ?? null) : null,
      ...(note !== undefined ? { note: note || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(rentCharges.id, found.charge.id))
    .returning();

  await logAudit({
    userId: gate.user.id,
    action: 'rental.payment_recorded',
    resourceType: 'rent_charge',
    resourceId: charge.id,
    oldValues: { paidAmount: found.charge.paidAmount },
    newValues: { paidAmount: charge.paidAmount, paidOn: charge.paidOn, paymentMethod: charge.paymentMethod },
  });
  if (found.lease.tenantUserId && Number(charge.paidAmount) > Number(found.charge.paidAmount)) {
    await createNotification({
      userId: found.lease.tenantUserId,
      type: 'rent_payment',
      title: 'Payment received',
      message: `Your landlord recorded ${usdText(charge.paidAmount)} toward ${monthName(charge.period)} rent.`,
      actionUrl: '/rental',
      actionLabel: 'See your rent',
    });
  }
  return NextResponse.json({ charge });
}

