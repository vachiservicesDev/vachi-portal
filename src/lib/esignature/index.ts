import { DropboxSignProvider } from './dropboxSign';
import type { ESignatureProvider } from './types';

export type { ESignatureProvider, SignatureRequestInput, SignatureRequestResult } from './types';

/**
 * Default provider is Dropbox Sign, per the "Recommended" option picked
 * during planning; the vendor choice is still open (see docs/PLAN.md). To
 * switch to DocuSign, add a DocuSignProvider implementing ESignatureProvider
 * and change this one line — nothing else in the onboarding flow depends
 * on which vendor is behind it.
 */
export function getESignatureProvider(): ESignatureProvider {
  return new DropboxSignProvider();
}
