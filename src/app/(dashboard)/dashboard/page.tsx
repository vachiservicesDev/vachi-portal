import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Proves the end-to-end auth + data path: middleware.ts already blocks
// unauthenticated requests, this re-checks (Server Components can't rely on
// middleware alone per Supabase's guidance) and reads the caller's own
// profile row through Drizzle. This route only ever needs the anon-key
// client + RLS — no service-role key involved.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  // A deactivated admin can still hold a valid Supabase session (sessions
  // aren't revoked by flipping is_active), so this has to be checked on
  // every load, not just at sign-in.
  if (profile && !profile.isActive) {
    await supabase.auth.signOut();
    redirect('/login?deactivated=1');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Signed in as <span className="font-medium">{user.email}</span>
        {profile ? ` — role: ${profile.role}` : ' — no profile row yet'}
      </p>
      <p className="mt-6 text-sm text-gray-500">
        This is the Phase 1 foundation only. See README.md for what&apos;s built so far and
        what&apos;s next.
      </p>
    </div>
  );
}
