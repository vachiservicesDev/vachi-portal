import { NextResponse } from 'next/server';
import { db } from '@/db';
import { h1bPublicAccessFiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [file] = await db
    .select()
    .from(h1bPublicAccessFiles)
    .where(eq(h1bPublicAccessFiles.id, params.id))
    .limit(1);
  if (!file) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({ file });
}
