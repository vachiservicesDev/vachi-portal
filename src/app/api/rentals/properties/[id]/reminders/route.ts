import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rentalReminders } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { ownedProperty } from '@/lib/rentals/access';
import { dec, reminderSchema } from '@/lib/rentals/schemas';

/** Adds an insurance, HOA, tax or other dated reminder to a home. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const property = await ownedProperty(gate.user.id, params.id);
  if (!property) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = reminderSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [reminder] = await db
    .insert(rentalReminders)
    .values({ ...body.data, amount: dec(body.data.amount), propertyId: property.id })
    .returning();
  return NextResponse.json({ reminder }, { status: 201 });
}
