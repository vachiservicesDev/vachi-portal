import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/requireAdmin';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  return NextResponse.json({ profile: gate.profile });
}
