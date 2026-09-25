import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { timesheets } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = reviewSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const [updated] = await db
    .update(timesheets)
    .set({
      status: body.data.decision,
      rejectionReason: body.data.decision === 'rejected' ? body.data.rejectionReason : null,
      approvedBy: gate.user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ timesheet: updated });
}
