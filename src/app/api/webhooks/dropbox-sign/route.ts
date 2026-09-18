import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { db } from '@/db';
import { onboardingDocuments, onboardingSessions } from '@/db/schema';
import { getESignatureProvider } from '@/lib/esignature';
import { uploadOnboardingFile } from '@/lib/storage/onboarding';
import { eq } from 'drizzle-orm';

interface DropboxSignEvent {
  event: {
    event_type: string;
    event_time: string;
    event_hash: string;
  };
  signature_request?: {
    signature_request_id: string;
  };
}

/**
 * Dropbox Sign posts `application/x-www-form-urlencoded` with a single
 * `json` field containing the event payload, and requires the response
 * body to be the literal string below or it will keep retrying the
 * webhook. See https://developers.hellosign.com/docs/webhook/ .
 *
 * event_hash verification below follows Dropbox Sign's documented scheme
 * (HMAC-SHA256 of `event_time + event_type` keyed with the API key) but,
 * like the rest of this adapter, hasn't been exercised against a live
 * webhook from this environment — confirm it against one real event before
 * relying on it, and treat an unverified signature as a reason to log and
 * investigate, not silently trust the payload in production.
 */
const ACK = 'Hello API Event Received';

function isValidEventHash(event: DropboxSignEvent['event']): boolean {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  if (!apiKey) return false;
  const expected = createHmac('sha256', apiKey)
    .update(event.event_time + event.event_type)
    .digest('hex');
  return expected === event.event_hash;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const raw = form.get('json');
  if (typeof raw !== 'string') {
    return new NextResponse(ACK); // nothing to do, but still acknowledge
  }

  const payload = JSON.parse(raw) as DropboxSignEvent;

  if (!isValidEventHash(payload.event)) {
    console.error('Dropbox Sign webhook: event_hash did not verify, ignoring payload');
    return new NextResponse(ACK);
  }

  if (
    payload.event.event_type === 'signature_request_all_signed' &&
    payload.signature_request?.signature_request_id
  ) {
    const requestId = payload.signature_request.signature_request_id;

    const [document] = await db
      .select()
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.signatureRequestId, requestId))
      .limit(1);

    if (document) {
      const provider = getESignatureProvider();
      const signedBytes = await provider.downloadSignedFile(requestId);
      const signedPath = `${document.sessionId}/${document.documentType}-signed.pdf`;
      await uploadOnboardingFile(signedPath, signedBytes);

      await db
        .update(onboardingDocuments)
        .set({ status: 'signed', signedFilePath: signedPath, signedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingDocuments.id, document.id));

      await db
        .update(onboardingSessions)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingSessions.id, document.sessionId));
    }
  }

  return new NextResponse(ACK);
}
