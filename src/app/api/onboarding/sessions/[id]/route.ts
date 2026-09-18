import { NextResponse } from 'next/server';
import { db } from '@/db';
import { onboardingDocuments, onboardingSessions } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.id, params.id))
    .limit(1);
  if (!session) return NextResponse.json({ message: 'Session not found' }, { status: 404 });

  const documents = await db
    .select()
    .from(onboardingDocuments)
    .where(eq(onboardingDocuments.sessionId, params.id));

  return NextResponse.json({ session, documents });
}
