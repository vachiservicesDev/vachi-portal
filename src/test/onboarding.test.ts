import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { auditLogs, notifications, onboardingDocuments, onboardingSessions } from '@/db/schema';
import { POST as createSession } from '@/app/api/onboarding/sessions/route';
import { POST as generateDoc } from '@/app/api/onboarding/sessions/[id]/generate/route';
import { POST as sendForSignature } from '@/app/api/onboarding/sessions/[id]/send/route';
import { POST as webhook } from '@/app/api/webhooks/dropbox-sign/route';
import { GET as meRoute } from '@/app/api/onboarding/me/route';
import { GET as documentFile } from '@/app/api/onboarding/documents/[id]/file/route';
import { POST as signDocument } from '@/app/api/onboarding/documents/[id]/sign/route';
import { eq } from 'drizzle-orm';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest, formDataRequest } from './http';
import { setCurrentUser } from './mockAuth';

process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

describe('Onboarding (Phase 2)', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  it('blocks a non-admin from creating a session', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);

    const res = await createSession(
      jsonRequest({
        employeeEmail: 'new.hire@test.local',
        firstName: 'New',
        lastName: 'Hire',
        employmentType: 'w2',
        startDate: '2026-01-05',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('full flow - admin creates, generates and sends; the employee signs in the portal', async () => {
    const { session, document } = await seedSentOnboardingDoc(adminId);
    expect(document.status).toBe('sent_for_signature');
    expect(document.signatureProvider).toBe('portal');

    const [sentSession] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, session.id));
    expect(sentSession.status).toBe('sent');

    const employeeProfile = await seedProfile({ role: 'employee', email: 'x@test.local' });
    setCurrentUser(employeeProfile.id);

    const fileRes = await documentFile(getRequest(), { params: { id: document.id } });
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('content-type')).toBe('application/pdf');

    const signRes = await signDocument(
      jsonRequest({ fullName: '  x   y ', consent: true }),
      { params: { id: document.id } },
    );
    expect(signRes.status).toBe(200);

    const [signedDoc] = await db.select().from(onboardingDocuments).where(eq(onboardingDocuments.id, document.id));
    expect(signedDoc.status).toBe('signed');
    expect(signedDoc.signedAt).not.toBeNull();
    expect(signedDoc.signedFilePath).toMatch(new RegExp(`^${session.id}/onboarding_acknowledgment-signed-\\d+\\.pdf$`));

    const [completedSession] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, session.id));
    expect(completedSession.status).toBe('completed');

    const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'onboarding_document_signed'));
    expect((audit.newValues as { signedName: string }).signedName).toBe('x   y');

    const [hrNote] = await db.select().from(notifications).where(eq(notifications.userId, adminId));
    expect(hrNote.type).toBe('onboarding_document_signed');

    const again = await signDocument(jsonRequest({ fullName: 'X Y', consent: true }), { params: { id: document.id } });
    expect(again.status).toBe(409);
  });

  it('refuses a signature with the wrong name or without consent', async () => {
    const { document } = await seedSentOnboardingDoc(adminId);
    const employeeProfile = await seedProfile({ role: 'employee', email: 'x@test.local' });
    setCurrentUser(employeeProfile.id);

    const wrongName = await signDocument(jsonRequest({ fullName: 'Someone Else', consent: true }), { params: { id: document.id } });
    expect(wrongName.status).toBe(400);
    const noConsent = await signDocument(jsonRequest({ fullName: 'X Y', consent: false }), { params: { id: document.id } });
    expect(noConsent.status).toBe(400);

    const [doc] = await db.select().from(onboardingDocuments).where(eq(onboardingDocuments.id, document.id));
    expect(doc.status).toBe('sent_for_signature');
  });

  it('accepts the name printed on the document when it differs from the employee record', async () => {
    const { session, document } = await seedSentOnboardingDoc(adminId);
    await db
      .update(onboardingSessions)
      .set({ formData: { ...session.formData, employeeName: 'Xavier Young' } })
      .where(eq(onboardingSessions.id, session.id));
    const employeeProfile = await seedProfile({ role: 'employee', email: 'x@test.local' });
    setCurrentUser(employeeProfile.id);

    const res = await signDocument(jsonRequest({ fullName: 'Xavier Young', consent: true }), { params: { id: document.id } });
    expect(res.status).toBe(200);
  });

  it("doesn't let another employee, or an admin, sign or open someone else's document", async () => {
    const { document } = await seedSentOnboardingDoc(adminId);

    const other = await seedProfile({ role: 'employee', email: 'other@test.local' });
    setCurrentUser(other.id);
    expect((await signDocument(jsonRequest({ fullName: 'X Y', consent: true }), { params: { id: document.id } })).status).toBe(404);
    expect((await documentFile(getRequest(), { params: { id: document.id } })).status).toBe(404);

    setCurrentUser(adminId);
    expect((await signDocument(jsonRequest({ fullName: 'X Y', consent: true }), { params: { id: document.id } })).status).toBe(404);
    expect((await documentFile(getRequest(), { params: { id: document.id } })).status).toBe(200);
  });

  it("can't sign a document HR hasn't sent yet", async () => {
    setCurrentUser(adminId);
    const createRes = await createSession(
      jsonRequest({ employeeEmail: 'x@test.local', firstName: 'X', lastName: 'Y', employmentType: 'w2', startDate: '2026-01-05' }),
    );
    const { session } = await createRes.json();
    const { document } = await (await generateDoc(getRequest(), { params: { id: session.id } })).json();

    const employeeProfile = await seedProfile({ role: 'employee', email: 'x@test.local' });
    setCurrentUser(employeeProfile.id);
    const res = await signDocument(jsonRequest({ fullName: 'X Y', consent: true }), { params: { id: document.id } });
    expect(res.status).toBe(409);
  });

  it('webhook ignores an event with a bad event_hash rather than trusting it', async () => {
    process.env.DROPBOX_SIGN_API_KEY = 'test-api-key';
    const { session, document } = await seedSentOnboardingDoc(adminId);

    const webhookRes = await webhook(
      formDataRequest({
        json: JSON.stringify({
          event: {
            event_type: 'signature_request_all_signed',
            event_time: '1700000000',
            event_hash: 'not-the-real-hash',
          },
          signature_request: { signature_request_id: document.signatureRequestId },
        }),
      }),
    );
    expect(webhookRes.status).toBe(200); // still acks, per Dropbox Sign's contract

    const [doc] = await db.select().from(onboardingDocuments).where(eq(onboardingDocuments.id, document.id));
    expect(doc.status).toBe('sent_for_signature'); // unchanged - forged event was ignored
    void session;
  });

  it('employee sees their own onboarding status via /me', async () => {
    setCurrentUser(adminId);
    const createRes = await createSession(
      jsonRequest({
        employeeEmail: 'matched@test.local',
        firstName: 'Matched',
        lastName: 'Employee',
        employmentType: '1099',
        startDate: '2026-02-01',
      }),
    );
    const { employee } = await createRes.json();

    // Employee signs up later with a matching email (Phase 1's documented
    // first-login-matches-by-email pattern).
    const employeeProfile = await seedProfile({ role: 'employee', email: employee.email });
    setCurrentUser(employeeProfile.id);

    const res = await meRoute();
    const data = await res.json();
    expect(data.session).not.toBeNull();
    expect(data.session.employmentType).toBe('1099');
  });

  it("employee with no onboarding session gets null, not someone else's", async () => {
    const unrelated = await seedProfile({ role: 'employee', email: 'nobody@test.local' });
    setCurrentUser(unrelated.id);

    const res = await meRoute();
    const data = await res.json();
    expect(data.session).toBeNull();
  });
});

async function seedSentOnboardingDoc(adminId: string) {
  setCurrentUser(adminId);
  const createRes = await createSession(
    jsonRequest({
      employeeEmail: 'x@test.local',
      firstName: 'X',
      lastName: 'Y',
      employmentType: 'w2',
      startDate: '2026-01-05',
    }),
  );
  const { session } = await createRes.json();
  const genRes = await generateDoc(getRequest(), { params: { id: session.id } });
  const { document } = await genRes.json();
  await sendForSignature(jsonRequest({ documentId: document.id }), { params: { id: session.id } });
  const [sentDoc] = await db.select().from(onboardingDocuments).where(eq(onboardingDocuments.id, document.id));
  return { session, document: sentDoc };
}
