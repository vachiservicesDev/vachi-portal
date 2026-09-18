import type { ESignatureProvider, SignatureRequestInput, SignatureRequestResult } from './types';

const API_BASE = 'https://api.hellosign.com/v3';

/**
 * Dropbox Sign (formerly HelloSign) adapter, talking to their REST API v3
 * directly rather than through their SDK, so the request/response shape
 * here is exactly what's on the wire and easy to debug against their API
 * reference. Sandbox testing is free: set DROPBOX_SIGN_TEST_MODE=true and
 * use a free Dropbox Sign developer account's API key — requests in test
 * mode don't count against any paid quota and don't produce legally binding
 * signatures, which is exactly what's needed for development.
 *
 * IMPORTANT: this was written against Dropbox Sign's documented v3 API
 * shape but has not been exercised against a live account from this
 * environment (no outbound network access here). Before relying on it,
 * run one real signature request against a sandbox account and confirm
 * the response fields below still match their current API reference,
 * particularly the webhook payload/signature-verification shape.
 */
export class DropboxSignProvider implements ESignatureProvider {
  readonly name = 'dropbox_sign';

  private get apiKey(): string {
    const key = process.env.DROPBOX_SIGN_API_KEY;
    if (!key) throw new Error('DROPBOX_SIGN_API_KEY is not set');
    return key;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
  }

  async createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    const form = new FormData();
    form.append('title', input.documentTitle);
    form.append('subject', `Please sign: ${input.documentTitle}`);
    form.append('message', 'Please review and sign this document.');
    form.append('signers[0][email_address]', input.signerEmail);
    form.append('signers[0][name]', input.signerName);
    form.append('test_mode', process.env.DROPBOX_SIGN_TEST_MODE === 'true' ? '1' : '0');
    if (process.env.DROPBOX_SIGN_WEBHOOK_CLIENT_ID) {
      // Only needed if using embedded signing; harmless to omit otherwise.
      form.append('client_id', process.env.DROPBOX_SIGN_WEBHOOK_CLIENT_ID);
    }
    form.append(
      'file[0]',
      new Blob([input.documentBytes as unknown as BlobPart], { type: 'application/pdf' }),
      `${input.documentTitle}.pdf`,
    );

    const response = await fetch(`${API_BASE}/signature_request/send`, {
      method: 'POST',
      headers: { Authorization: this.authHeader() },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Dropbox Sign send failed (${response.status}): ${body}`);
    }

    const json = (await response.json()) as {
      signature_request: { signature_request_id: string };
    };

    return { requestId: json.signature_request.signature_request_id };
  }

  async downloadSignedFile(requestId: string): Promise<Uint8Array> {
    const response = await fetch(
      `${API_BASE}/signature_request/files/${requestId}?file_type=pdf`,
      { headers: { Authorization: this.authHeader() } },
    );

    if (!response.ok) {
      throw new Error(`Dropbox Sign file download failed (${response.status})`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }
}
