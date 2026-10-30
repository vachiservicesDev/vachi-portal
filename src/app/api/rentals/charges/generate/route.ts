import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentCharges, rentalLeases, rentalProperties } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { dueDateFor, leaseCoversPeriod, periodStart } from '@/lib/rentals/rent';

const schema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a month.') });

/**
 * Adds a month's rent for every active lease the caller owns that covers that month. Safe to run
 * again: a lease that already has that month is skipped, so nothing is ever charged twice.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const period = periodStart(body.data.month);
  const leases = await db
    .select({ lease: rentalLeases })
    .from(rentalLeases)
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalLeases.propertyId))
    .where(and(eq(rentalProperties.ownerId, gate.user.id), eq(rentalLeases.status, 'active')));

  const rows = leases
    .map((r) => r.lease)
    .filter((l) => leaseCoversPeriod(l, period))
    .map((l) => ({ leaseId: l.id, period, dueDate: dueDateFor(period, l.dueDay), amount: l.monthlyRent }));

  const created = rows.length
    ? await db.insert(rentCharges).values(rows).onConflictDoNothing({ target: [rentCharges.leaseId, rentCharges.period] }).returning({ id: rentCharges.id })
    : [];
  return NextResponse.json({ created: created.length, skipped: rows.length - created.length });
}
