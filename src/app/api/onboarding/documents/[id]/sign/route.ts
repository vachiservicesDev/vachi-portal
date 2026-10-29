import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { onboardingDocuments, onboardingSessions } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { loadOwnDocument } from '@/lib/esignature/access';
import { normalizeName, sha256, stampSignature } from '@/lib/esignature/portal';
import { downloadOnboardingFile, uploadOnboardingFile } from '@/lib/storage/onboarding';
import { createNotification } from '@/lib/notifications/create';
import { logAudit } from '@/lib/audit/log';
import { and, eq } from 'drizzle-orm';

const signSchema = z.object({
  fullName: z.string().trim().min(1, 'Type your full name to sign.').max(200),
  consent: z.literal(true, { errorMap: () => ({ message: 'Tick the box to agree to sign electronically.' }) }),
});

/** The employee signs their own document inside the portal. Admins can't sign on someone's behalf. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await loadOwnDocument(params.id, { ...gate.profile, role: 'employee' });
  if (!found) return NextResponse.json({ message: 'Document not found' }, { status: 404 });
  const { document, session, employee } = found;

  if (document.status !== 'sent_for_signature' || !document.generatedFilePath) {
    return NextResponse.json(
      { message: document.status === 'signed' ? 'You already signed this document.' : "HR hasn't sent this document for signature yet." },
      { status: 409 },
    );
  }

  const body = signSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  }
  // The name printed on the document can differ from the employee record (HR typed it when starting
  // onboarding), so either one signs.
  const expected = `${employee.firstName} ${employee.lastName}`;
  const onDocument = (session.formData as { employeeName?: string } | null)?.employeeName;
  const accepted = [expected, onDocument].filter((n): n is string => !!n).map(normalizeName);
  if (!accepted.includes(normalizeName(body.data.fullName))) {
    return NextResponse.json(
      { message: 'Invalid input', errors: { formErrors: [], fieldErrors: { fullName: [`Type your full name as HR has it: ${expected}.`] } } },
      { status: 400 },
    );
  }

  const signedAt = new Date();
  const ipAddress = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const userAgent = request.headers.get('user-agent') ?? '';
  const original = await downloadOnboardingFile(document.generatedFilePath);
  const signed = await stampSignature(original, {
    signerName: body.data.fullName,
    signerEmail: employee.email,
    signedAt,
    ipAddress,
    userAgent,
    documentId: document.id,
  });
  // A path per attempt, so a second, overlapping request that loses the update below can't
  // overwrite the PDF that was actually accepted.
  const signedPath = `${session.id}/${document.documentType}-signed-${signedAt.getTime()}.pdf`;
  await uploadOnboardingFile(signedPath, signed);

  // The status condition makes a double-click sign once, not twice.
  const [updated] = await db
    .update(onboardingDocuments)
    .set({ status: 'signed', signedFilePath: signedPath, signedAt, updatedAt: signedAt })
    .where(and(eq(onboardingDocuments.id, document.id), eq(onboardingDocuments.status, 'sent_for_signature')))
    .returning();
  if (!updated) return NextResponse.json({ message: 'You already signed this document.' }, { status: 409 });

  const pending = await db
    .select({ id: onboardingDocuments.id })
    .from(onboardingDocuments)
    .where(and(eq(onboardingDocuments.sessionId, session.id), eq(onboardingDocuments.status, 'sent_for_signature')));
  if (pending.length === 0) {
    await db
      .update(onboardingSessions)
      .set({ status: 'completed', completedAt: signedAt, updatedAt: signedAt })
      .where(eq(onboardingSessions.id, session.id));
  }

  await logAudit({
    userId: gate.user.id,
    action: 'onboarding_document_signed',
    resourceType: 'onboarding_document',
    resourceId: document.id,
    newValues: { signedName: body.data.fullName, signedAt: signedAt.toISOString(), ipAddress, userAgent, originalSha256: sha256(original), consent: true },
  });

  if (session.createdBy) {
    await createNotification({
      userId: session.createdBy,
    type: 'onboarding_document_signed',
      title: `${expected} signed their onboarding document`,
      message: 'The signed copy is ready to view.',
      actionUrl: `/admin/onboarding/${session.id}`,
      actionLabel: 'View',
    });
  }

  return NextResponse.json({ document: updated });
}
