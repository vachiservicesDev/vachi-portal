import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, onboardingDocuments, onboardingSessions, profiles } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';

// Matches by email since employees.user_id is only linked once someone
// actually has a Supabase Auth account (onboarding starts before that).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!profile) return NextResponse.json({ session: null, documents: [] });

  const [employee] = await db.select().from(employees).where(eq(employees.email, profile.email)).limit(1);
  if (!employee) return NextResponse.json({ session: null, documents: [] });

  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.employeeId, employee.id))
    .limit(1);
  if (!session) return NextResponse.json({ session: null, documents: [] });

  const documents = await db
    .select()
    .from(onboardingDocuments)
    .where(eq(onboardingDocuments.sessionId, session.id));

  return NextResponse.json({ session, documents });
}
