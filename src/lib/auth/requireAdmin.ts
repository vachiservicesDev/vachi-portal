import { db } from '@/db';
import { profiles } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';

/**
 * Shared admin gate for API routes. Returns the caller's profile row when
 * they're an active admin, otherwise a ready-to-return NextResponse-shaped
 * error so route handlers can `const gate = await requireAdmin(); if
 * (!gate.ok) return gate.response;` without duplicating this check.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, message: 'Not signed in' };
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (!profile || !profile.isActive || profile.role !== 'admin') {
    return { ok: false as const, status: 403, message: 'Admin access required' };
  }

  return { ok: true as const, user, profile };
}
