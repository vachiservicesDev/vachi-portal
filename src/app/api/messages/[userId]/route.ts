import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { findPartner } from '@/lib/messages/partners';
import { and, asc, eq, isNull, or } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const partner = await findPartner({ id: gate.user.id, role: gate.profile.role }, params.userId);
  if (!partner) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const conversation = await db
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.senderId, gate.user.id), eq(messages.recipientId, partner.id)),
        and(eq(messages.senderId, partner.id), eq(messages.recipientId, gate.user.id)),
      ),
    )
    .orderBy(asc(messages.createdAt));

  // Mark incoming messages as read now that they've been fetched.
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.senderId, partner.id), eq(messages.recipientId, gate.user.id), isNull(messages.readAt)));

  const { isActive, ...publicPartner } = partner;
  return NextResponse.json({ messages: conversation, partner: { ...publicPartner, isActive }, me: gate.user.id });
}

const sendSchema = z.object({ body: z.string().trim().min(1, 'Write a message first.').max(5000, 'Keep messages under 5,000 characters.') });

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const partner = await findPartner({ id: gate.user.id, role: gate.profile.role }, params.userId);
  if (!partner) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!partner.isActive) return NextResponse.json({ message: 'This person no longer has portal access.' }, { status: 409 });

  const body = sendSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [message] = await db.insert(messages).values({ senderId: gate.user.id, recipientId: partner.id, body: body.data.body }).returning();

  return NextResponse.json({ message }, { status: 201 });
}
