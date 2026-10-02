import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, profiles, trainingComments } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { createNotification } from '@/lib/notifications/create';
import { loadAssignmentForCaller } from '@/lib/training/access';
import { asc, eq } from 'drizzle-orm';

const commentSchema = z.object({ body: z.string().trim().min(1, 'Write a comment first.').max(5000) });

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, allowed } = await loadAssignmentForCaller(params.id, gate.profile);
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const comments = await db
    .select({
      id: trainingComments.id,
      body: trainingComments.body,
      createdAt: trainingComments.createdAt,
      authorId: trainingComments.authorId,
      authorEmail: profiles.email,
      authorRole: profiles.role,
      authorFirstName: employees.firstName,
      authorLastName: employees.lastName,
    })
    .from(trainingComments)
    .innerJoin(profiles, eq(profiles.id, trainingComments.authorId))
    .leftJoin(employees, eq(employees.userId, trainingComments.authorId))
    .where(eq(trainingComments.assignmentId, params.id))
    .orderBy(asc(trainingComments.createdAt));

  return NextResponse.json({ comments, me: gate.user.id });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const { assignment, employee, allowed } = await loadAssignmentForCaller(params.id, gate.profile);
  if (!assignment) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const body = commentSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [comment] = await db
    .insert(trainingComments)
    .values({ assignmentId: params.id, authorId: gate.user.id, body: body.data.body })
    .returning();

  // HR commenting on someone's training lets them know.
  if (gate.profile.role === 'admin' && employee?.userId && employee.userId !== gate.user.id) {
    await createNotification({
      userId: employee.userId,
      type: 'training_comment',
      title: 'New comment on your training',
      message: body.data.body.slice(0, 140),
      actionUrl: `/training/${params.id}`,
      actionLabel: 'Open training',
    });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
