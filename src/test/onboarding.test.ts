import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { onboardingDocuments, onboardingSessions } from '@/db/schema';
import { POST as createSession } from '@/app/api/onboarding/sessions/route';
import { POST as generateDoc } from '@/app/api/onboarding/sessions/[id]/generate/route';
import { POST as sendForSignature } from '@/app/api/onboarding/sessions/[id]/send/route';
import { POST as webhook } from '@/app/api/webhooks/dropbox-sign/route';
import { GET as meRoute } from '@/app/api/onboarding/me/route';
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

  it('admin: full flow - create, generate, send, webhook completes it', async () => {
    setCurrentUser(adminId);

    const createRes = await createSession(
      jsonRequest({
        employeeEmail: 'new.hire@test.local',
        firstName: 'New',
        lastName: 'Hire',
        employmentType: 'w2',
        startDate: '2026-01-05',
      }),
    );
    expect(createRes.status).toBe(201);
    const { session } = await createRes.json();
    expect(session.status).toBe('draft');

    const genRes = await generateDoc(getRequest(), { params: { id: session.id } });
    expect(genRes.status).toBe(201);
    const { document } = await genRes.json();
    expect(document.status).toBe('generated');
    expect(document.generatedFilePath).toBe(`${session.id}/onboarding-acknowledgment.pdf`);

    const sendRes = await sendForSignature(jsonRequest({ documentId: document.id }), {
      params: { id: session.id },
    });
    expect(sendRes.status).toBe(200);

    const [sentDoc] = await db
      .select()
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.id, document.id));
    expect(sentDoc.status).toBe('sent_for_signature');
    expect(sentDoc.signatureRequestId).toBe('test-request-id');

    const [sentSession] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.id, session.id));
    expect(sentSession.status).toBe('sent');

    // Simulate Dropbox Sign's webhook reporting the signature complete.
    // event_hash must match src/app/api/webhooks/dropbox-sign/route.ts's
    // HMAC verification, which reads DROPBOX_SIGN_API_KEY.
    process.env.DROPBOX_SIGN_API_KEY = 'test-api-key';
    const { createHmac } = await import('node:crypto');
    const eventTime = '1700000000';
    const eventType = 'signature_request_all_signed';
    const eventHash = createHmac('sha256', 'test-api-key').update(eventTime + eventType).digest('hex');

    const webhookRes = await webhook(
      formDataRequest({
        json: JSON.stringify({
          event: { event_type: eventType, event_time: eventTime, event_hash: eventHash },
          signature_request: { signature_request_id: 'test-request-id' },
        }),
      }),
    );
    expect(webhookRes.status).toBe(200);

    const [signedDoc] = await db
      .select()
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.id, document.id));
    expect(signedDoc.status).toBe('signed');
    expect(signedDoc.signedFilePath).toBe(`${session.id}/onboarding_acknowledgment-signed.pdf`);

    const [completedSession] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.id, session.id));
    expect(completedSession.status).toBe('completed');
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
