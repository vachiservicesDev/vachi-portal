import { NextResponse } from 'next/server';
import { db } from '@/db';
import { onboardingDocuments, onboardingSessions } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { generateOnboardingPdf, type OnboardingFormData } from '@/lib/pdf/onboarding';
import { uploadOnboardingFile } from '@/lib/storage/onboarding';
import { eq } from 'drizzle-orm';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.id, params.id))
    .limit(1);

  if (!session) {
    return NextResponse.json({ message: 'Session not found' }, { status: 404 });
  }

  const formData = session.formData as OnboardingFormData;
  const pdfBytes = await generateOnboardingPdf({
    ...formData,
    employmentType: session.employmentType,
  });

  const path = `${session.id}/onboarding-acknowledgment.pdf`;
  await uploadOnboardingFile(path, pdfBytes);

  const [document] = await db
    .insert(onboardingDocuments)
    .values({
      sessionId: session.id,
      documentType: 'onboarding_acknowledgment',
      status: 'generated',
      generatedFilePath: path,
    })
    .returning();

  return NextResponse.json({ document }, { status: 201 });
}
