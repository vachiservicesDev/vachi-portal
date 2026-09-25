import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, performanceReviews } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const adminUpdateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  goals: z.string().optional(),
  submit: z.coerce.boolean().optional(),
});

const employeeAckSchema = z.object({ acknowledge: z.literal(true) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [review] = await db
    .select()
    .from(performanceReviews)
    .where(eq(performanceReviews.id, params.id))
    .limit(1);
  if (!review) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const rawBody = await request.json();

  if (gate.profile.role === 'admin') {
    const body = adminUpdateSchema.safeParse(rawBody);
    if (!body.success) {
      return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
        status: 400,
      });
    }
    const { submit, ...rest } = body.data;
    const [updated] = await db
      .update(performanceReviews)
      .set({
        ...rest,
        status: submit ? 'submitted' : review.status,
        submittedAt: submit ? new Date() : review.submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(performanceReviews.id, params.id))
      .returning();
    return NextResponse.json({ review: updated });
  }

  // Employee path: acknowledgment only, and only their own review.
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, review.employeeId))
    .limit(1);
  if (!employee || employee.email !== gate.profile.email) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = employeeAckSchema.safeParse(rawBody);
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const [updated] = await db
    .update(performanceReviews)
    .set({ employeeAcknowledgedAt: new Date(), updatedAt: new Date() })
    .where(eq(performanceReviews.id, params.id))
    .returning();

  return NextResponse.json({ review: updated });
}
