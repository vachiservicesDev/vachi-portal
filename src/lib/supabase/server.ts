import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions — uses the anon key + the caller's session cookie.
 * Used here mainly for `auth.getUser()`. If this client's `.from(...)` is
 * ever used for a data query, that query IS RLS-enforced — but most data
 * access in this app goes through Drizzle (src/db) instead, which connects
 * via a direct Postgres connection and does NOT go through RLS; see the
 * authorization note at the top of src/db/schema.ts before assuming a
 * Drizzle-backed route is RLS-protected.
 *
 * The service-role key (full RLS bypass, src/lib/supabase/admin.ts) should
 * only ever be used in a narrow, explicitly-reviewed set of server-only
 * admin operations.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component with no response to write to;
            // safe to ignore as long as middleware.ts is refreshing sessions.
          }
        },
      },
    },
  );
}
