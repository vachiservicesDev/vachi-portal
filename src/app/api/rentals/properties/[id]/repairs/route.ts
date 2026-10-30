import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { repairRequests } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { ownedProperty } from '@/lib/rentals/access';
import { repairCreateSchema } from '@/lib/rentals/schemas';

/** The landlord logs a repair themselves (tenants report theirs from /rental). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = repairCreateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [repair] = await db.insert(repairRequests).values({ ...body.data, propertyId: property.id, reportedBy: gate.user.id }).returning();
  return NextResponse.json({ repair }, { status: 201 });
}
