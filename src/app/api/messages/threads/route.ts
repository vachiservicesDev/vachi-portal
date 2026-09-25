import { NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

/**
 * Thread list is just "every other active user I could message" - admins
 * see all employees, employees see all admins. There's no separate
 * conversation/thread table; a conversation is derived from messages
 * between two specific profile ids (see /api/messages/[userId]).
 */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const targetRole = gate.profile.role === 'admin' ? 'employee' : 'admin';

  const partners = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.role, targetRole));

  return NextResponse.json({ partners });
}
