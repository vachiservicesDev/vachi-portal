import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, onboardingDocuments, onboardingSessions } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { PORTAL_PROVIDER } from '@/lib/esignature/portal';
import { createNotification } from '@/lib/notifications/create';
import { sendPortalMail, signRequestEmail, smtpConfigured } from '@/lib/email/portal-mail';
import { and, eq } from 'drizzle-orm';

const sendSchema = z.object({ documentId: z.string().uuid() });

/**
 * Sends a generated document to the employee for signature inside the portal: they sign it on
 * /onboarding. The employee gets an in-app notification (once they have a login) and an email
 * from the portal's Gmail when SMTP is set up; the email is best-effort, the send never fails on it.
 */
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
    .where(and(eq(onboardingDocuments.id, body.data.documentId), eq(onboardingDocuments.sessionId, session.id)))
    .limit(1);
  if (!document || !document.generatedFilePath) {
    return NextResponse.json({ message: 'Document not generated yet' }, { status: 400 });
  }
  if (document.status === 'signed') {
    return NextResponse.json({ message: 'This document is already signed.' }, { status: 409 });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, session.employeeId))
    .limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  await db
    .update(onboardingDocuments)
    .set({
      status: 'sent_for_signature',
      signatureProvider: PORTAL_PROVIDER,
      signatureRequestId: document.id,
      updatedAt: new Date(),
    })
    .where(eq(onboardingDocuments.id, document.id));

  await db
    .update(onboardingSessions)
    .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
    .where(eq(onboardingSessions.id, session.id));

  if (employee.userId) {
    await createNotification({
      userId: employee.userId,
      type: 'onboarding_signature_requested',
      title: 'A document is waiting for your signature',
      message: 'Review and sign your onboarding acknowledgment.',
      priority: 'high',
      actionUrl: '/onboarding',
      actionLabel: 'Review and sign',
    });
  }

  let emailed = false;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
  if (smtpConfigured()) {
    try {
      await sendPortalMail(employee.email, signRequestEmail(employee.firstName, 'Onboarding acknowledgment', `${appUrl}/onboarding`));
      emailed = true;
    } catch (err) {
      console.error('Signature request email failed', err);
    }
  }

  return NextResponse.json({ requestId: document.id, emailed });
}
