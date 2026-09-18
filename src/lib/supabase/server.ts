import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions — uses the anon key + the caller's session cookie, so
 * RLS is enforced as the real authorization boundary (not bypassed the way
 * the legacy backend's service-role client does everywhere).
 *
 * The service-role key (full RLS bypass) should only ever be used in a
 * narrow, explicitly-reviewed set of server-only admin operations — not as
 * the default client, which was the legacy app's mistake.
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
