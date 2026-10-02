import { ownsEmployee } from '@/lib/employees';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, performanceReviews } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { createNotification } from '@/lib/notifications/create';
import { eq } from 'drizzle-orm';

const adminUpdateSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Rating is 1 to 5.').max(5, 'Rating is 1 to 5.').optional(),
  strengths: z.string().max(10000).optional(),
  areasForImprovement: z.string().max(10000).optional(),
  goals: z.string().max(10000).optional(),
  submit: z.boolean().optional(),
});

const employeeAckSchema = z.object({ acknowledge: z.literal(true) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const [review] = await db
    .select()
    .from(performanceReviews)
    .where(eq(performanceReviews.id, params.id))
    .limit(1);
  if (!review) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const rawBody = await request.json();

  const [employee] = await db.select().from(employees).where(eq(employees.id, review.employeeId)).limit(1);
  const isOwner = ownsEmployee(employee, gate.profile);

  // An admin acknowledging their own review takes the employee path below.
  if (gate.profile.role === 'admin' && !(isOwner && rawBody?.acknowledge === true)) {
    if (review.status !== 'draft') {
      return NextResponse.json({ message: 'This review has already been shared with the employee and can’t be edited.' }, { status: 409 });
    }
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

    if (submit) {
      if (employee?.userId) {
        await createNotification({
          userId: employee.userId,
          type: 'performance_review_submitted',
          title: 'New performance review',
          message: `A performance review for ${updated.periodStart} – ${updated.periodEnd} is ready for you to view.`,
          actionUrl: '/reviews',
          actionLabel: 'View review',
        });
      }
    }

    return NextResponse.json({ review: updated });
  }

  // Employee path: acknowledgment only, and only their own review.
  if (!isOwner || review.status === 'draft') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = employeeAckSchema.safeParse(rawBody);
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
  if (review.employeeAcknowledgedAt) return NextResponse.json({ review });

  const [updated] = await db
    .update(performanceReviews)
    .set({ employeeAcknowledgedAt: new Date(), status: 'approved', updatedAt: new Date() })
    .where(eq(performanceReviews.id, params.id))
    .returning();

  return NextResponse.json({ review: updated });
}
