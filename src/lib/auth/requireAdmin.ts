import { db } from '@/db';
import { profiles } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

/**
 * True for a login HR created with a starting password that hasn't been replaced yet. Those
 * sessions may only reach /set-password, so the HR-known password can't be used to work in the
 * portal, through its pages or directly through the API.
 */
export function mustChangePassword(user: Pick<User, 'user_metadata'>): boolean {
  return !!user.user_metadata?.must_change_password;
}

const CHANGE_PASSWORD = { ok: false as const, status: 403, message: 'Choose your own password before continuing.' };

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
  if (mustChangePassword(user)) return CHANGE_PASSWORD;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (!profile || !profile.isActive || profile.role !== 'admin') {
    return { ok: false as const, status: 403, message: 'Admin access required' };
  }

  return { ok: true as const, user, profile };
}

/** Same shape as requireAdmin, but accepts any active signed-in user. */
export async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, message: 'Not signed in' };
  }
  if (mustChangePassword(user)) return CHANGE_PASSWORD;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (!profile || !profile.isActive) {
    return { ok: false as const, status: 403, message: 'Account inactive' };
  }

  return { ok: true as const, user, profile };
}
