import { cache } from 'react';
import { redirect } from 'next/navigation';
import { and, count, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { employees, notifications, profiles } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';

export type PortalSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

/**
 * The signed-in user, their portal profile and (when there is one) their employee record.
 * Cached per request, so the layout and the page share one lookup.
 */
export const loadSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const email = (profile?.email ?? user.email ?? '').toLowerCase();
  const [employee] = await db
    .select()
    .from(employees)
    .where(or(eq(employees.userId, user.id), sql`lower(${employees.email}) = ${email}`))
    .limit(1);

  let unread = 0;
  if (profile) {
    const [row] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.status, 'unread')));
    unread = Number(row?.n ?? 0);
  }

  const displayName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : email.split('@')[0];
  return { user, profile: profile ?? null, employee: employee ?? null, email, displayName, unread };
});

/** For pages: the session, or a redirect to sign-in. */
export async function requireSession() {
  const session = await loadSession();
  if (!session) redirect('/login');
  return session;
}

/** Where a signed-in user lands: admins on the admin dashboard, everyone else on their home. */
export function homeFor(role: string | null | undefined) {
  return role === 'admin' ? '/admin' : '/dashboard';
}
