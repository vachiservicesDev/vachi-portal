import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { greenCardCases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [gcCase] = await db.select().from(greenCardCases).where(eq(greenCardCases.id, params.id)).limit(1);
  if (!gcCase) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({ case: gcCase });
}

const updateSchema = z.object({
  stage: z.enum([
    'perm_prep',
    'perm_filed',
    'perm_certified',
    'i140_filed',
    'i140_approved',
    'i485_filed',
    'i485_approved',
    'denied',
  ]),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const [updated] = await db
    .update(greenCardCases)
    .set({ ...body.data, stageUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(greenCardCases.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ case: updated });
}
