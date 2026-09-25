import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { i9Records } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getEVerifyProvider } from '@/lib/everify';
import { eq } from 'drizzle-orm';

const everifySchema = z.object({ caseNumber: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [record] = await db.select().from(i9Records).where(eq(i9Records.id, params.id)).limit(1);
  if (!record) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const body = everifySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'caseNumber is required' }, { status: 400 });
  }

  const provider = getEVerifyProvider();
  const result = await provider.recordCase({
    employeeId: record.employeeId,
    caseNumber: body.data.caseNumber,
  });

  const [updated] = await db
    .update(i9Records)
    .set({
      everifyCaseNumber: result.caseNumber,
      everifyStatus: result.status,
      everifySubmittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(i9Records.id, params.id))
    .returning();

  return NextResponse.json({ record: updated });
}
