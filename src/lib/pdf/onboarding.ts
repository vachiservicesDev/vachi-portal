import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface OnboardingFormData {
  employeeName: string;
  employmentType: 'w2' | '1099';
  startDate: string;
  position?: string;
  department?: string;
  visaType?: string;
  authorizedSignatoryName?: string;
  [key: string]: unknown;
}

/**
 * Generates the onboarding acknowledgment document as a real PDF, built
 * programmatically rather than filled into a .docx template on disk. This
 * is a deliberate departure from the legacy app, which stored .docx
 * templates on ephemeral local disk (lost on every redeploy) and rebuilt
 * the final PDF from plain stripped text, discarding formatting. Here the
 * layout lives in code (versioned, redeploy-safe) and IS the final,
 * correctly-formatted document — no lossy intermediate step.
 *
 * This starter form covers the common fields across W-2/1099 onboarding.
 * Additional document types (e.g. a real Form I-9, offer letter) are added
 * as their own generator functions following this same pattern — this is
 * not meant to be the only document type long-term.
 */
export async function generateOnboardingPdf(data: OnboardingFormData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  const left = 56;
  const lineHeight = 20;

  function drawLine(text: string, opts: { bold?: boolean; size?: number } = {}) {
    page.drawText(text, {
      x: left,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }

  drawLine('Employment Onboarding Acknowledgment', { bold: true, size: 16 });
  y -= 8;
  drawLine(`Employment type: ${data.employmentType.toUpperCase()}`);
  drawLine(`Employee name: ${data.employeeName}`);
  drawLine(`Start date: ${data.startDate}`);
  if (data.position) drawLine(`Position: ${data.position}`);
  if (data.department) drawLine(`Department: ${data.department}`);
  if (data.visaType) drawLine(`Visa type: ${data.visaType}`);

  y -= 16;
  drawLine(
    'By signing below, the employee acknowledges receipt of this onboarding packet and',
  );
  drawLine('agrees to the terms of employment discussed with Vachi Services LLC.');

  y -= 40;
  drawLine('Employee signature: ____________________________');
  y -= 30;
  if (data.authorizedSignatoryName) {
    drawLine(`Authorized signatory: ${data.authorizedSignatoryName}`);
  }
  drawLine('Company signature: ____________________________');

  return pdfDoc.save();
}
