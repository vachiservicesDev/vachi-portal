import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { and, asc, eq, isNull, or } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const conversation = await db
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.senderId, gate.user.id), eq(messages.recipientId, params.userId)),
        and(eq(messages.senderId, params.userId), eq(messages.recipientId, gate.user.id)),
      ),
    )
    .orderBy(asc(messages.createdAt));

  // Mark incoming messages as read now that they've been fetched.
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.senderId, params.userId),
        eq(messages.recipientId, gate.user.id),
        isNull(messages.readAt),
      ),
    );

  return NextResponse.json({ messages: conversation });
}

const sendSchema = z.object({ body: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = sendSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'body is required' }, { status: 400 });

  const [message] = await db
    .insert(messages)
    .values({ senderId: gate.user.id, recipientId: params.userId, body: body.data.body })
    .returning();

  return NextResponse.json({ message }, { status: 201 });
}
