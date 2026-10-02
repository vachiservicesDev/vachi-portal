import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, greenCardCases } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [row] = await db
    .select({ gcCase: greenCardCases, employeeFirstName: employees.firstName, employeeLastName: employees.lastName, employeeEmail: employees.email })
    .from(greenCardCases)
    .innerJoin(employees, eq(employees.id, greenCardCases.employeeId))
    .where(eq(greenCardCases.id, params.id))
    .limit(1);
  if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({
    case: { ...row.gcCase, employeeFirstName: row.employeeFirstName, employeeLastName: row.employeeLastName, employeeEmail: row.employeeEmail },
  });
}

const updateSchema = z.object({
  stage: z.enum(['perm_prep', 'perm_filed', 'perm_certified', 'i140_filed', 'i140_approved', 'i485_filed', 'i485_approved', 'denied'], {
    errorMap: () => ({ message: 'Choose a stage.' }),
  }),
  // An empty string clears the field.
  priorityDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')]).optional(),
  notes: z.string().max(5000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [before] = await db.select().from(greenCardCases).where(eq(greenCardCases.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const { stage, priorityDate, notes } = body.data;
  const stageChanged = stage !== before.stage;
  const [updated] = await db
    .update(greenCardCases)
    .set({
      stage,
      ...(priorityDate !== undefined ? { priorityDate: priorityDate || null } : {}),
      ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
      ...(stageChanged ? { stageUpdatedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(greenCardCases.id, params.id))
    .returning();

  await logAudit({
    userId: gate.user.id,
    action: stageChanged ? 'green_card.stage_changed' : 'green_card.updated',
    resourceType: 'green_card_case',
    resourceId: updated.id,
    oldValues: { stage: before.stage, priorityDate: before.priorityDate },
    newValues: { stage: updated.stage, priorityDate: updated.priorityDate },
  });

  return NextResponse.json({ case: updated });
}
