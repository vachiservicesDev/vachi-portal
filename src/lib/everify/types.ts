export interface EVerifyCaseInput {
  employeeId: string;
  caseNumber: string;
}

export type EVerifyCaseStatus =
  | 'not_created'
  | 'submitted'
  | 'employment_authorized'
  | 'tentative_nonconfirmation'
  | 'final_nonconfirmation'
  | 'closed';

/**
 * Abstraction over however E-Verify case data gets into this system. See
 * manualProvider.ts for why this is manual-entry only today, not a live
 * DHS API call.
 */
export interface EVerifyProvider {
  readonly name: string;
  recordCase(input: EVerifyCaseInput): Promise<{ caseNumber: string; status: EVerifyCaseStatus }>;
}
