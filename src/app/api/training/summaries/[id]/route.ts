import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { weeklyTrainingSummaries } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewComments: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = reviewSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [updated] = await db
    .update(weeklyTrainingSummaries)
    .set({
      status: body.data.status,
      reviewComments: body.data.reviewComments,
      reviewedBy: gate.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(weeklyTrainingSummaries.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ summary: updated });
}
