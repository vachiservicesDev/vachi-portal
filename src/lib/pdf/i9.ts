import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface I9Section1Data {
  legalFirstName: string;
  legalLastName: string;
  otherLastNames?: string;
  address: string;
  dateOfBirth: string;
  ssn?: string;
  email?: string;
  phone?: string;
  citizenshipStatus:
    | 'us_citizen'
    | 'noncitizen_national'
    | 'lawful_permanent_resident'
    | 'alien_authorized_to_work';
  alienRegistrationNumber?: string; // LPR or alien-authorized
  workAuthorizationExpiration?: string; // required if alien_authorized_to_work
  i94AdmissionNumber?: string;
  foreignPassportNumber?: string;
  foreignPassportCountry?: string;
}

export interface I9Section2Data {
  documentTitle: string;
  issuingAuthority: string;
  documentNumber: string;
  expirationDate?: string;
  firstDayOfEmployment: string;
  employerRepresentativeName: string;
}

/**
 * Produces an audit-record snapshot of the I-9 data captured in this
 * system - NOT a pixel-accurate reproduction of the official USCIS Form
 * I-9 PDF. If an exact USCIS-layout PDF is required (e.g. for a specific
 * auditor's expectations), fill the real USCIS Form I-9 PDF's form fields
 * instead of generating this from scratch - track that as a follow-up
 * rather than assuming this snapshot satisfies every audit requirement.
 */
export async function generateI9Pdf(
  section1: I9Section1Data,
  section2: I9Section2Data | null,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  const left = 56;
  const lineHeight = 18;

  function drawLine(text: string, opts: { bold?: boolean; size?: number } = {}) {
    page.drawText(text, {
      x: left,
      y,
      size: opts.size ?? 10,
      font: opts.bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }

  drawLine('Form I-9 Data Record (internal snapshot, not the official USCIS PDF)', {
    bold: true,
    size: 13,
  });
  y -= 10;

  drawLine('Section 1 - Employee Information and Attestation', { bold: true, size: 12 });
  drawLine(`Name: ${section1.legalFirstName} ${section1.legalLastName}`);
  if (section1.otherLastNames) drawLine(`Other last names used: ${section1.otherLastNames}`);
  drawLine(`Address: ${section1.address}`);
  drawLine(`Date of birth: ${section1.dateOfBirth}`);
  if (section1.email) drawLine(`Email: ${section1.email}`);
  if (section1.phone) drawLine(`Phone: ${section1.phone}`);
  drawLine(`Citizenship/immigration status: ${section1.citizenshipStatus}`);
  if (section1.alienRegistrationNumber) {
    drawLine(`Alien Registration Number/USCIS Number: ${section1.alienRegistrationNumber}`);
  }
  if (section1.workAuthorizationExpiration) {
    drawLine(`Work authorization expiration: ${section1.workAuthorizationExpiration}`);
  }
  if (section1.i94AdmissionNumber) drawLine(`Form I-94 Admission Number: ${section1.i94AdmissionNumber}`);
  if (section1.foreignPassportNumber) {
    drawLine(
      `Foreign passport: ${section1.foreignPassportNumber} (${section1.foreignPassportCountry ?? 'country not given'})`,
    );
  }

  y -= 10;
  drawLine('Section 2 - Employer Review and Verification', { bold: true, size: 12 });
  if (section2) {
    drawLine(`Document: ${section2.documentTitle}`);
    drawLine(`Issuing authority: ${section2.issuingAuthority}`);
    drawLine(`Document number: ${section2.documentNumber}`);
    if (section2.expirationDate) drawLine(`Expiration date: ${section2.expirationDate}`);
    drawLine(`First day of employment: ${section2.firstDayOfEmployment}`);
    drawLine(`Examined by: ${section2.employerRepresentativeName}`);
  } else {
    drawLine('(not yet completed)');
  }

  return pdfDoc.save();
}
