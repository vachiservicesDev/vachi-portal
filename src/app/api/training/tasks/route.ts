import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { trainingTasks } from '@/db/schema';
import { requireActiveUser, requireAdmin } from '@/lib/auth/requireAdmin';
import { desc, sql } from 'drizzle-orm';

const createSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(255),
  description: z.string().max(10000).optional(),
  type: z.enum(['general', 'compliance', 'safety', 'technical']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').optional(),
  estimatedDurationMinutes: z.coerce.number().int('Use whole minutes.').positive('Use a number above 0.').max(100_000).optional(),
  contentUrl: z.string().url('Enter a full link, starting with https://').optional().or(z.literal('')),
  // Checkbox values arrive as "on"; JSON callers may send true/false.
  isMandatory: z.union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false')]).transform((v) => v === true || v === 'on' || v === 'true').optional(),
});

export async function GET() {
  // Any active user can browse the task catalog (assignment, not the
  // catalog itself, is what's access-controlled).
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const tasks = await db
    .select({
      task: trainingTasks,
      assignedCount: sql<number>`(select count(*)::int from training_assignments a where a.task_id = ${trainingTasks.id})`,
      completedCount: sql<number>`(select count(*)::int from training_assignments a where a.task_id = ${trainingTasks.id} and a.status = 'completed')`,
    })
    .from(trainingTasks)
    .orderBy(desc(trainingTasks.createdAt));
  return NextResponse.json({ tasks: tasks.map((t) => ({ ...t.task, assignedCount: t.assignedCount, completedCount: t.completedCount })) });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [task] = await db
    .insert(trainingTasks)
    .values({ ...body.data, contentUrl: body.data.contentUrl || undefined, createdBy: gate.user.id })
    .returning();

  return NextResponse.json({ task }, { status: 201 });
}
