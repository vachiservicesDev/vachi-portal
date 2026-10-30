import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalLeases, rentalProperties } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { propertySchema } from '@/lib/rentals/schemas';

/** The caller's own rental homes, each with its current tenant (if any). */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const homes = await db.select().from(rentalProperties).where(eq(rentalProperties.ownerId, gate.user.id)).orderBy(asc(rentalProperties.name));
  const leases = await db
    .select({ propertyId: rentalLeases.propertyId, tenantName: rentalLeases.tenantName, monthlyRent: rentalLeases.monthlyRent, endDate: rentalLeases.endDate })
    .from(rentalLeases)
    .innerJoin(rentalProperties, eq(rentalProperties.id, rentalLeases.propertyId))
    .where(and(eq(rentalProperties.ownerId, gate.user.id), eq(rentalLeases.status, 'active')));

  const properties = homes.map((p) => {
    const lease = leases.find((l) => l.propertyId === p.id);
    return { ...p, tenantName: lease?.tenantName ?? null, monthlyRent: lease?.monthlyRent ?? null, leaseEnds: lease?.endDate ?? null };
  });
  return NextResponse.json({ properties });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = propertySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [property] = await db.insert(rentalProperties).values({ ...body.data, ownerId: gate.user.id }).returning();
  return NextResponse.json({ property }, { status: 201 });
}
