import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { and, eq } from 'drizzle-orm';

export async function POST() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const updated = await db
    .update(notifications)
    .set({ status: 'read', readAt: new Date() })
    .where(and(eq(notifications.userId, gate.user.id), eq(notifications.status, 'unread')))
    .returning({ id: notifications.id });

  return NextResponse.json({ updated: updated.length });
}
