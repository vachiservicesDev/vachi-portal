import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, gate.user.id))
    .orderBy(desc(notifications.createdAt));

  return NextResponse.json({ notifications: rows });
}
