import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Signs out and returns to the login page. Used when a deactivated account loads a page. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get('reason') === 'deactivated' ? 'deactivated' : 'signed-out';
  return NextResponse.redirect(new URL(`/login?reason=${reason}`, request.url));
}
