import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, trainingAssignments, trainingComments } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { asc, eq } from 'drizzle-orm';

const commentSchema = z.object({ body: z.string().min(1) });

async function canAccess(assignmentId: string, callerEmail: string, isAdmin: boolean) {
  const [assignment] = await db
    .select()
    .from(trainingAssignments)
    .where(eq(trainingAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) return false;
  if (isAdmin) return true;

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, assignment.employeeId))
    .limit(1);
  return employee?.email === callerEmail;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!(await canAccess(params.id, gate.profile.email, gate.profile.role === 'admin'))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const comments = await db
    .select()
    .from(trainingComments)
    .where(eq(trainingComments.assignmentId, params.id))
    .orderBy(asc(trainingComments.createdAt));

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!(await canAccess(params.id, gate.profile.email, gate.profile.role === 'admin'))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = commentSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'body is required' }, { status: 400 });

  const [comment] = await db
    .insert(trainingComments)
    .values({ assignmentId: params.id, authorId: gate.user.id, body: body.data.body })
    .returning();

  return NextResponse.json({ comment }, { status: 201 });
}
