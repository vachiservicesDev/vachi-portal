import { describe, expect, it } from 'vitest';
import { generateOnboardingPdf } from '@/lib/pdf/onboarding';
import { generateI9Pdf } from '@/lib/pdf/i9';

function isValidPdf(bytes: Uint8Array): boolean {
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  return header === '%PDF-';
}

describe('PDF generation', () => {
  it('generateOnboardingPdf produces a well-formed, non-trivial PDF', async () => {
    const bytes = await generateOnboardingPdf({
      employeeName: 'Jane Doe',
      employmentType: 'w2',
      startDate: '2026-01-05',
      position: 'Software Engineer',
      visaType: 'H1B',
    });
    expect(isValidPdf(bytes)).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it('generateI9Pdf works with Section 1 only (Section 2 not yet completed)', async () => {
    const bytes = await generateI9Pdf(
      {
        legalFirstName: 'Jane',
        legalLastName: 'Doe',
        address: '123 Main St',
        dateOfBirth: '1990-01-01',
        citizenshipStatus: 'alien_authorized_to_work',
        alienRegistrationNumber: 'A123456789',
        workAuthorizationExpiration: '2027-01-01',
      },
      null,
    );
    expect(isValidPdf(bytes)).toBe(true);
  });

  it('generateI9Pdf with both sections completed includes Section 2 fields', async () => {
    const bytes = await generateI9Pdf(
      {
        legalFirstName: 'Jane',
        legalLastName: 'Doe',
        address: '123 Main St',
        dateOfBirth: '1990-01-01',
        citizenshipStatus: 'us_citizen',
      },
      {
        documentTitle: 'US Passport',
        issuingAuthority: 'US Dept of State',
        documentNumber: '123456789',
        firstDayOfEmployment: '2026-01-05',
        employerRepresentativeName: 'admin@vachi.test',
      },
    );
    expect(isValidPdf(bytes)).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
