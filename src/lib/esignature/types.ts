export interface SignatureRequestInput {
  documentBytes: Uint8Array;
  documentTitle: string;
  signerEmail: string;
  signerName: string;
  /** Absolute URL the provider POSTs completion events to. */
  webhookUrl: string;
}

export interface SignatureRequestResult {
  /** Provider-specific id, stored on onboarding_documents.signature_request_id. */
  requestId: string;
  /** Hosted signing page to redirect the signer to, when the provider returns one directly. */
  signingUrl?: string;
}

/**
 * Vendor-agnostic e-signature interface. The confirmed product decision is
 * "a certified vendor" (DocuSign or Dropbox Sign) rather than in-house
 * signature capture; the vendor itself is still an open decision (see
 * docs/PLAN.md). Coding against this interface means swapping providers
 * later is a new adapter file, not a rewrite of the onboarding flow.
 */
export interface ESignatureProvider {
  readonly name: string;
  createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult>;
  /** Downloads the final, signed document once the provider reports completion. */
  downloadSignedFile(requestId: string): Promise<Uint8Array>;
}
