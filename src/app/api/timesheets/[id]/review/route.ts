import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, timesheets } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';
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

  const [before] = await db.select().from(timesheets).where(eq(timesheets.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });

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

  await logAudit({
    userId: gate.user.id,
    action: `timesheet.${body.data.decision}`,
    resourceType: 'timesheet',
    resourceId: updated.id,
    oldValues: { status: before.status },
    newValues: { status: updated.status },
  });

  const [employee] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);
  if (employee?.userId) {
    await createNotification({
      userId: employee.userId,
      type: 'timesheet_reviewed',
      title: `Timesheet ${body.data.decision}`,
      message:
        body.data.decision === 'rejected'
          ? `Your timesheet for ${updated.weekStarting} was rejected${body.data.rejectionReason ? `: ${body.data.rejectionReason}` : ''}`
          : `Your timesheet for ${updated.weekStarting} was approved`,
      priority: body.data.decision === 'rejected' ? 'high' : 'medium',
      actionUrl: `/timesheets/${updated.id}`,
      actionLabel: 'View timesheet',
    });
  }

  return NextResponse.json({ timesheet: updated });
}
