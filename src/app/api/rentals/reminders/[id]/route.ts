import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalReminders } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { ownedReminder } from '@/lib/rentals/access';
import { dec, reminderSchema } from '@/lib/rentals/schemas';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const before = await ownedReminder(gate.user.id, params.id);
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const body = reminderSchema.partial().safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const { amount, ...rest } = body.data;
  const [reminder] = await db
    .update(rentalReminders)
    .set({ ...rest, ...(amount !== undefined ? { amount: dec(amount) } : {}), updatedAt: new Date() })
    .where(eq(rentalReminders.id, before.id))
    .returning();
  return NextResponse.json({ reminder });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const before = await ownedReminder(gate.user.id, params.id);
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  await db.delete(rentalReminders).where(eq(rentalReminders.id, before.id));
  return NextResponse.json({ ok: true });
}
