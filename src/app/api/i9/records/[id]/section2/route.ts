import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { i9Records } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { generateI9Pdf, type I9Section1Data } from '@/lib/pdf/i9';
import { uploadI9Snapshot } from '@/lib/storage/i9';
import { eq } from 'drizzle-orm';

const section2Schema = z.object({
  documentTitle: z.string().min(1),
  issuingAuthority: z.string().min(1),
  documentNumber: z.string().min(1),
  expirationDate: z.string().optional(),
  firstDayOfEmployment: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [record] = await db.select().from(i9Records).where(eq(i9Records.id, params.id)).limit(1);
  if (!record) return NextResponse.json({ message: 'Record not found' }, { status: 404 });
  if (!record.section1Data) {
    return NextResponse.json({ message: 'Section 1 has not been completed yet' }, { status: 400 });
  }

  const body = section2Schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const section2Data = {
    ...body.data,
    employerRepresentativeName: `${gate.profile.email}`,
  };

  const pdfBytes = await generateI9Pdf(record.section1Data as I9Section1Data, section2Data);
  const path = `${record.id}/i9-record.pdf`;
  await uploadI9Snapshot(path, pdfBytes);

  const [updated] = await db
    .update(i9Records)
    .set({
      section2Data,
      section2CompletedBy: gate.user.id,
      section2CompletedAt: new Date(),
      status: 'complete',
      updatedAt: new Date(),
    })
    .where(eq(i9Records.id, params.id))
    .returning();

  return NextResponse.json({ record: updated, snapshotPath: path });
}
