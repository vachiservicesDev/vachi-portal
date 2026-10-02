import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, weeklyTrainingSummaries } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownsEmployee } from '@/lib/employees';
import { createNotification } from '@/lib/notifications/create';
import { eq } from 'drizzle-orm';

const reviewSchema = z
  .object({
    status: z.enum(['approved', 'rejected'], { errorMap: () => ({ message: 'Choose approve or return.' }) }),
    reviewComments: z.string().trim().max(5000).optional(),
  })
  .refine((v) => v.status === 'approved' || !!v.reviewComments, { message: 'Say what needs to change, so they can fix it.', path: ['reviewComments'] });

const editSchema = z.object({
  content: z.string().trim().min(1, 'Write what you worked on this week.').max(20000),
  submit: z.boolean().optional(),
});

/**
 * HR approves or returns a submitted summary. The employee edits their own draft or returned
 * summary, and can submit it.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const [row] = await db
    .select({ summary: weeklyTrainingSummaries, employee: employees })
    .from(weeklyTrainingSummaries)
    .innerJoin(employees, eq(employees.id, weeklyTrainingSummaries.employeeId))
    .where(eq(weeklyTrainingSummaries.id, params.id))
    .limit(1);
  if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const { summary, employee } = row;
  const raw = await request.json();

  if (ownsEmployee(employee, gate.profile)) {
    const body = editSchema.safeParse(raw);
    if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
    if (summary.status !== 'draft' && summary.status !== 'rejected') {
      return NextResponse.json({ message: 'This summary has been submitted and can’t be changed now.' }, { status: 409 });
    }
    const [updated] = await db
      .update(weeklyTrainingSummaries)
      .set({
        content: body.data.content,
        ...(body.data.submit ? { status: 'submitted' as const, submittedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(weeklyTrainingSummaries.id, params.id))
      .returning();
    return NextResponse.json({ summary: updated });
  }

  if (gate.profile.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const body = reviewSchema.safeParse(raw);
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  if (summary.status !== 'submitted') {
    return NextResponse.json({ message: 'Only submitted summaries can be reviewed.' }, { status: 409 });
  }

  const [updated] = await db
    .update(weeklyTrainingSummaries)
    .set({
      status: body.data.status,
      reviewComments: body.data.reviewComments || null,
      reviewedBy: gate.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(weeklyTrainingSummaries.id, params.id))
    .returning();

  if (employee.userId) {
    await createNotification({
      userId: employee.userId,
      type: body.data.status === 'approved' ? 'summary_approved' : 'summary_returned',
      title: body.data.status === 'approved' ? 'Weekly summary approved' : 'Weekly summary returned',
      message:
        body.data.status === 'approved'
          ? `Your summary for the week of ${summary.weekStarting} was approved.`
          : `Your summary for the week of ${summary.weekStarting} needs changes: ${body.data.reviewComments}`.slice(0, 280),
      actionUrl: '/training/summaries',
      actionLabel: 'View summaries',
    });
  }

  return NextResponse.json({ summary: updated });
}
