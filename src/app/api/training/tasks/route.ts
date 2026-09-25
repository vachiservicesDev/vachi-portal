import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { trainingTasks } from '@/db/schema';
import { requireActiveUser, requireAdmin } from '@/lib/auth/requireAdmin';
import { desc } from 'drizzle-orm';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['general', 'compliance', 'safety', 'technical']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  dueDate: z.string().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional(),
  contentUrl: z.string().url().optional().or(z.literal('')),
  isMandatory: z.coerce.boolean().optional(),
});

export async function GET() {
  // Any active user can browse the task catalog (assignment, not the
  // catalog itself, is what's access-controlled).
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const tasks = await db.select().from(trainingTasks).orderBy(desc(trainingTasks.createdAt));
  return NextResponse.json({ tasks });
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
