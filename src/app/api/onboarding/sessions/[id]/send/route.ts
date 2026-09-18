import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, onboardingDocuments, onboardingSessions } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getESignatureProvider } from '@/lib/esignature';
import { downloadOnboardingFile } from '@/lib/storage/onboarding';
import { eq } from 'drizzle-orm';

const sendSchema = z.object({ documentId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = sendSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'documentId is required' }, { status: 400 });
  }

  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.id, params.id))
    .limit(1);
  if (!session) return NextResponse.json({ message: 'Session not found' }, { status: 404 });

  const [document] = await db
    .select()
    .from(onboardingDocuments)
    .where(eq(onboardingDocuments.id, body.data.documentId))
    .limit(1);
  if (!document || !document.generatedFilePath) {
    return NextResponse.json({ message: 'Document not generated yet' }, { status: 400 });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, session.employeeId))
    .limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const bytes = await downloadOnboardingFile(document.generatedFilePath);
  const provider = getESignatureProvider();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { message: 'NEXT_PUBLIC_APP_URL is not set — required to build the signature webhook URL' },
      { status: 500 },
    );
  }

  const result = await provider.createSignatureRequest({
    documentBytes: bytes,
    documentTitle: 'Employment Onboarding Acknowledgment',
    signerEmail: employee.email,
    signerName: `${employee.firstName} ${employee.lastName}`,
    webhookUrl: `${appUrl}/api/webhooks/dropbox-sign`,
  });

  await db
    .update(onboardingDocuments)
    .set({
      status: 'sent_for_signature',
      signatureProvider: provider.name,
      signatureRequestId: result.requestId,
      updatedAt: new Date(),
    })
    .where(eq(onboardingDocuments.id, document.id));

  await db
    .update(onboardingSessions)
    .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
    .where(eq(onboardingSessions.id, session.id));

  return NextResponse.json({ requestId: result.requestId });
}
