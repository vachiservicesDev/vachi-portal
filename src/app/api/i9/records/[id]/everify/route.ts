import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { i9Records } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getEVerifyProvider } from '@/lib/everify';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit/log';

// HR creates the case in the real E-Verify portal, then records its number here and, as the case
// moves on, its result (manual entry; see src/lib/everify/manualProvider.ts).
const everifySchema = z.object({
  caseNumber: z.string().trim().min(1, 'Enter the E-Verify case number.'),
  status: z
    .enum(['submitted', 'employment_authorized', 'tentative_nonconfirmation', 'final_nonconfirmation', 'closed'])
    .optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [record] = await db.select().from(i9Records).where(eq(i9Records.id, params.id)).limit(1);
  if (!record) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const body = everifySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'caseNumber is required', errors: body.error.flatten() }, { status: 400 });
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
      everifyStatus: body.data.status ?? result.status,
      everifySubmittedAt: record.everifySubmittedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(i9Records.id, params.id))
    .returning();

  await logAudit({
    userId: gate.user.id,
    action: 'everify_case_recorded',
    resourceType: 'i9_record',
    resourceId: record.id,
    oldValues: { caseNumber: record.everifyCaseNumber, status: record.everifyStatus },
    newValues: { caseNumber: updated.everifyCaseNumber, status: updated.everifyStatus },
  });

  return NextResponse.json({ record: updated });
}
