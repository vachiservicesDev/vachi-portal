import type { EVerifyCaseInput, EVerifyProvider } from './types';

/**
 * Deliberately NOT a live DHS E-Verify Web Services client. Two reasons:
 *
 * 1. Using the live API requires DHS employer (and employer-agent, if
 *    applicable) enrollment first, which is a business/legal step this
 *    codebase can't complete on its own - see docs/PLAN.md.
 * 2. The DHS API's exact request/response contract isn't something to
 *    guess at for a federal compliance system the way an adapter can
 *    reasonably be written against a well-documented public SaaS API
 *    (e.g. src/lib/esignature/dropboxSign.ts). Writing a best-effort DHS
 *    client without verified documentation risks silently-wrong
 *    compliance behavior, which is worse than not having it.
 *
 * So for now: an admin creates the case directly in the real E-Verify
 * portal (once enrolled) and records the case number/status here, the
 * same way the legacy app never automated this at all. When DHS
 * enrollment is complete and the Web Services API contract is in hand,
 * implement a DhsEVerifyProvider against that documentation and swap it
 * in via getEVerifyProvider() below - nothing else in the I-9 module
 * depends on which one is active.
 */
export class ManualEVerifyProvider implements EVerifyProvider {
  readonly name = 'manual';

  async recordCase(input: EVerifyCaseInput) {
    return { caseNumber: input.caseNumber, status: 'submitted' as const };
  }
}
